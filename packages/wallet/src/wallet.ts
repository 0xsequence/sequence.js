import {
  Provider,
  TransactionResponse,
  BlockTag,
  ExternalProvider,
  JsonRpcProvider,
  TransactionRequest
} from '@ethersproject/providers'
import { BigNumber, BigNumberish, ethers, Signer as AbstractSigner } from 'ethers'
import { Interface, ConnectionInfo, BytesLike, Deferrable, resolveProperties } from 'ethers/lib/utils' 

import { walletContracts } from '@0xsequence/abi'

import {
  SequenceTransaction, Transactionish, AuxTransactionRequest, NonceDependency,
  encodeMetaTransactionsData,
  isSequenceTransaction,
  readSequenceNonce,
  appendNonce,
  hasSequenceTransactions,
  toSequenceTransactions,
  sequenceTxAbiEncode,
  makeExpirable,
  makeAfterNonce
} from '@0xsequence/transactions'

import { Relayer } from '@0xsequence/relayer'

import { WalletContext, JsonRpcSender } from '@0xsequence/network'

import {
  WalletConfig,
  addressOf,
  sortConfig,
  compareAddr,
  imageHash,
  isUsableConfig,
  aggregate
} from './config'

import { RemoteSigner } from './remote-signers'

import { packMessageData, resolveArrayProperties } from './utils'

import { WalletSigner } from './signer'

// Wallet is a signer interface to a Smart Contract based Ethereum account.
//
// Wallet allows managing the account/wallet sub-keys, wallet address, signing
// messages, signing transactions and updating/deploying the wallet config on a specific chain.
export class Wallet extends WalletSigner {
  private readonly _signers: AbstractSigner[]

  readonly context: WalletContext
  readonly config: WalletConfig

  // provider is an Ethereum Json RPC provider that is connected to a particular network (aka chain)
  // and access to the signer for signing transactions.
  provider: JsonRpcProvider

  // sender is a minimal Json RPC sender interface. It's here for convenience for other web3
  // interfaces to use.
  sender: JsonRpcSender

  // relayer dispatches transactions to an Ethereum node directly
  // or through a remote transaction Web Service.
  relayer: Relayer

  constructor(config: WalletConfig, context: WalletContext, ...signers: (BytesLike | AbstractSigner)[]) {
    super()

    if (!context.nonStrict && !isUsableConfig(config)) throw new Error('non-usable configuration in strict mode')

    this._signers = signers.map(s => (AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s)))

    this.config = sortConfig(config)
    this.context = context
  }

  // useConfig creates a new Wallet instance with the provided config, and uses the current provider
  // and relayer.
  useConfig(config: WalletConfig): Wallet {
    return new Wallet(config, this.context, ...this._signers)
      .setProvider(this.provider)
      .setRelayer(this.relayer)
  }

  // connect is a short-hand to create an Account instance and set the provider and relayer.
  //
  // The connect method is defined on the AbstractSigner as connect(Provider): AbstractSigner
  connect(provider: Provider | ConnectionInfo | string, relayer?: Relayer): Wallet {
    // TODO: This only works with JsonRpcProviders
    return new Wallet(this.config, this.context, ...this._signers).setProvider(provider as unknown as JsonRpcProvider).setRelayer(relayer)
  }

  // connected reports if json-rpc provider has been connected
  get connected(): boolean {
    return this.sender !== undefined
  }

  // address returns the address of the wallet account address
  get address(): string {
    return addressOf(this.config, this.context)
  }

  // getAddress returns the address of the wallet account address
  //
  // The getAddress method is defined on the AbstractSigner
  async getAddress(): Promise<string> {
    return this.address
  }

  // getSigners returns the multi-sig signers with permission to control the wallet
  async getSigners(): Promise<string[]> {
    return Promise.all(this._signers.map((s) => s.getAddress()))
  }

  // chainId returns the network connected to this wallet instance
  //
  // NOTE: AbstractSigner also offers getChainId(): Promise<number>
  async chainId(): Promise<BigNumberish> {
    return (await this.provider.getNetwork()).chainId
  }

  // setProvider assigns a json-rpc provider to this wallet instance
  setProvider(provider: JsonRpcProvider | ConnectionInfo | string): Wallet {
    if (Provider.isProvider(provider)) {
      this.provider = provider
      this.sender = new JsonRpcSender(provider)
    } else {
      const jsonProvider = new JsonRpcProvider(<ConnectionInfo | string>provider)
      this.provider = jsonProvider
      this.sender = new JsonRpcSender(jsonProvider)
    }
    return this
  }

  // setRelayer assigns a Sequence transaction relayer to this wallet instance
  setRelayer(relayer: Relayer): Wallet {
    this.relayer = relayer
    return this
  }

  // geNonce returns the transaction nonce for this wallet, via the relayer
  async getNonce(blockTag?: BlockTag): Promise<number> {
    return this.relayer.getNonce(this.config, this.context, 0, blockTag)
  }

  // getTransactionCount returns the number of transactions (aka nonce)
  //
  // getTransactionCount method is defined on the AbstractSigner
  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    return this.getNonce(blockTag)
  }

  // sendTransaction will dispatch the transaction to the relayer for submission to the network.
  async sendTransaction(dtransactionish: Deferrable<Transactionish>, allSigners?: boolean): Promise<TransactionResponse> {
    const transaction = (await resolveArrayProperties<Transactionish>(dtransactionish))

    if (!this.provider) {
      throw new Error('missing provider')
    }
    if (!this.relayer) {
      throw new Error('missing relayer')
    }

    let stx: SequenceTransaction[] = []

    if (Array.isArray(transaction)) {
      if (hasSequenceTransactions(transaction)) {
        stx = transaction as SequenceTransaction[]
      } else {
        stx = await toSequenceTransactions(this, transaction)
      }
    } else if (isSequenceTransaction(transaction)) {
      stx = [transaction]
    } else {
      stx = await toSequenceTransactions(this, [transaction])
    }

    // If transaction is marked as expirable
    // append expirable require
    if ((<AuxTransactionRequest>transaction).expiration) {
      stx = makeExpirable(this.context, stx, (<AuxTransactionRequest>transaction).expiration)
    }

    // If transaction depends on another nonce
    // append after nonce requirement
    if ((<AuxTransactionRequest>transaction).afterNonce) {
      const after = (<AuxTransactionRequest>transaction).afterNonce
      stx = makeAfterNonce(this.context, stx,
        (<NonceDependency>after).address ? {
          address: (<NonceDependency>after).address,
          nonce: (<NonceDependency>after).nonce,
          space: (<NonceDependency>after).space
        } : {
          address: this.address,
          nonce: <BigNumberish>after
        }
      )
    }

    // If a transaction has 0 gasLimit and not revertOnError
    // compute all new gas limits
    if (stx.find((a) => !a.revertOnError && ethers.BigNumber.from(a.gasLimit).eq(ethers.constants.Zero))) {
      stx = await this.relayer.estimateGasLimits(this.config, this.context, ...stx)
    }

    const providedNonce = readSequenceNonce(...stx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    stx = appendNonce(stx, nonce)
    const signature = this.signTransactions(stx, allSigners)
    return this.relayer.relay(this.config, this.context, signature, ...stx)
  }

  // signTransactions will sign a Sequence transaction with the wallet signers
  async signTransactions(txs: SequenceTransaction[], allSigners?: boolean): Promise<string> {
    const packed = encodeMetaTransactionsData(...txs)
    return this.sign(packed, false, undefined, allSigners)
  }

  // signMessage will sign a message for a particular chainId with the wallet signers
  //
  // NOTE: signMessage(message: Bytes | string): Promise<string> is defined on AbstractSigner
  async signMessage(message: BytesLike, chainId?: number, allSigners?: boolean): Promise<string> {
    return this.sign(message, false, chainId, allSigners)
  }

  // sign is a helper method to sign a payload with the wallet signers
  async sign(msg: BytesLike, isDigest: boolean = true, chainId?: number, allSigners?: boolean): Promise<string> {
    const signChainId = chainId ? chainId : await this.chainId()
    const digest = ethers.utils.arrayify(isDigest ? msg :
      ethers.utils.keccak256(
        packMessageData(
          this.address,
          signChainId,
          ethers.utils.keccak256(msg)
        )
      )
    )

    // Sign digest using a set of signers and some optional data
    const signWith = async (signers: AbstractSigner[], auxData?: string) => {
      const signersAddr = Promise.all(signers.map(s => s.getAddress()))

      const accountBytes = await Promise.all(
        this.config.signers.map(async a => {
          const signerIndex = (await signersAddr).indexOf(a.address)
          const signer = signers[signerIndex]

          try {
            if (signer) {
              return ethers.utils.solidityPack(
                ['bool', 'uint8', 'bytes'],
                [false, a.weight, (await RemoteSigner.signMessageWithData(signer, digest, auxData)) + '02']
              )
            }
          } catch (e) {
            if (allSigners) {
              throw e
            } else {
              console.warn(`Skipped signer ${a.address}`)
            }
          }

          return ethers.utils.solidityPack(['bool', 'uint8', 'address'], [true, a.weight, a.address])
        })
      )
  
      return ethers.utils.solidityPack(
        ['uint16', ...Array(this.config.signers.length).fill('bytes')],
        [this.config.threshold, ...accountBytes]
      )
    }

    // Split local signers and remote signers
    const localSigners = this._signers.filter((s) => !RemoteSigner.isRemoteSigner(s))
    const remoteSigners = this._signers.filter((s) => RemoteSigner.isRemoteSigner(s))

    // Sign message first using localSigners
    // include local signatures for remote signers
    const localSignature = await signWith(localSigners, this.packMsgAndSig(msg, [], signChainId))
    const remoteSignature = await signWith(remoteSigners, this.packMsgAndSig(msg, localSignature, signChainId))

    // Aggregate both local and remote signatures
    return aggregate(localSignature, remoteSignature)
  }

  // signWeight will return the total weight of all signers available based on the config
  async signWeight(): Promise<BigNumber> {
    const signers = await this.getSigners()
    return signers.reduce((p, s) => {
      const sconfig = this.config.signers.find((c) => c.address === s)
      if (!sconfig) return p
      return p.add(sconfig.weight)
    }, ethers.constants.Zero)
  }

  // buildUpdateConfigTransaction creates a transaction object of the an updated wallet config state update.
  //
  // The `publish` argument publishes the WalletConfig object to the chain, where as normally we only
  // store the hash of a config.
  async buildUpdateConfigTransaction(
    config: WalletConfig,
    publish = false
  ): Promise<SequenceTransaction[]> {
    if (!this.context.nonStrict && !isUsableConfig(config)) throw new Error('non-usable new configuration in strict mode')

    const isUpgradable = await (async () => {
      try {
        const implementation = await this.provider.getStorageAt(this.address, ethers.utils.defaultAbiCoder.encode(['string'], [this.address]))
        return compareAddr(implementation, this.context.mainModuleUpgradable) === 0
      } catch {
        return false
      }
    })()

    const walletInterface = new Interface(walletContracts.mainModule.abi)

    // 131072 gas, enough for both calls
    // and a power of two to keep the gas cost of data low
    const gasLimit = ethers.constants.Two.pow(17)

    const preTransaction = isUpgradable ? [] : [{
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.address,
      value: ethers.constants.Zero,
      data: walletInterface.encodeFunctionData(walletInterface.getFunction('updateImplementation'), 
        [this.context.mainModuleUpgradable]
      )
    }]

    const mainModuleInterface = new Interface(walletContracts.mainModuleUpgradable.abi)

    const transaction = {
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.address,
      value: ethers.constants.Zero,
      data: mainModuleInterface.encodeFunctionData(mainModuleInterface.getFunction('updateImageHash'),
        [imageHash(sortConfig(config))]
      )
    }

    const requireUtilsInterface = new Interface(walletContracts.requireUtils.abi)

    const postTransaction = publish ? [{
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.context.requireUtils,
      value: ethers.constants.Zero,
      data: requireUtilsInterface.encodeFunctionData(requireUtilsInterface.getFunction('requireConfig'), 
        [
          this.address,
          config.threshold,
          sortConfig(config).signers.map((s) => ({
            weight: s.weight,
            signer: s.address
          }))
        ]
      )
    }] : []

    const transactions = [...preTransaction, transaction, ...postTransaction]

    return [{
      delegateCall: false,
      revertOnError: false,
      gasLimit: gasLimit,
      to: this.address,
      value: ethers.constants.Zero,
      data: walletInterface.encodeFunctionData(walletInterface.getFunction('selfExecute'),
        [sequenceTxAbiEncode(transactions)]
      )
    }]
  }

  // updateConfig will build an updated config transaction and send/publish it to the network
  // via the relayer
  async updateConfig(
    config: WalletConfig,
    nonce?: number,
    publish = false
  ): Promise<[WalletConfig, TransactionResponse]> {
    const [txs, n] = await Promise.all([
      this.buildUpdateConfigTransaction(config, publish),
      nonce ? nonce : await this.getNonce()]
    )

    return [
      { address: this.address, ...config},
      await this.sendTransaction(appendNonce(txs, n))
    ]
  }

  // publishConfig will publish the wallet config to the network via the relayer. Publishing
  // the config will also store the entire object of signers.
  async publishConfig(
    nonce?: number
  ): Promise<TransactionResponse> {
    const requireUtilsInterface = new Interface(walletContracts.requireUtils.abi)
    return this.sendTransaction({
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.context.requireUtils,
      value: ethers.constants.Zero,
      nonce: nonce,
      data: requireUtilsInterface.encodeFunctionData(requireUtilsInterface.getFunction('requireConfig'), 
        [
          this.address,
          this.config.threshold,
          sortConfig(this.config).signers.map((s) => ({
            weight: s.weight,
            signer: s.address
          }))
        ]
      )
    })
  }

  signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }

  // packMsgAndSig is used by RemoteSigners to include details as a string blob of data.
  private packMsgAndSig(msg: BytesLike, sig: BytesLike, chainId: BigNumberish): string {
    return ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes', 'bytes'], [this.address, chainId, msg, sig])
  }

  // singleOwner will create a Wallet instance with a single signer (ie. a single EOA account)
  static async singleOwner(context: WalletContext, owner: BytesLike | AbstractSigner): Promise<Wallet> {
    const signer = AbstractSigner.isSigner(owner) ? owner : new ethers.Wallet(owner)

    const config = {
      threshold: 1,
      signers: [
        {
          weight: 1,
          address: await signer.getAddress()
        }
      ]
    }

    return new Wallet(config, context, owner)
  }
}

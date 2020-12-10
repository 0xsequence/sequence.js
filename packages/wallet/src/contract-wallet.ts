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

import { JsonRpcSender } from '@0xsequence/provider'


import { RemoteSigner } from './signers/remote-signer'

import {
  IRelayer,
  SequenceTransaction, Transactionish, AuxTransactionRequest, NonceDependency,
  encodeMetaTransactionsData,
  isSequenceTransaction,
  readSequenceNonce,
  appendNonce,
  hasSequenceTransactions,
  toSequenceTransactions,
  sequenceTxAbiEncode,
  makeExpirable,
  makeAfterNonce,
} from '@0xsequence/transactions'

import { WalletContext } from '@0xsequence/networks'

import {
  WalletConfig,
  addressOf,
  sortConfig,
  packMessageData,
  compareAddr,
  imageHash,
  isUsableConfig,
  aggregate
} from '@0xsequence/auth'

import { resolveArrayProperties } from './utils'

// ContractWallet is an interface to the Sequence Wallet Contract on a specific network/chain.
// Wallet class allows managing the wallet sub-keys, wallet address, signing messages,
// signing transactions and updating/deploying the wallet config on a specific chain.
export class ContractWallet extends AbstractSigner {
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
  relayer: IRelayer

  constructor(config: WalletConfig, context: WalletContext, ...signers: (BytesLike | AbstractSigner)[]) {
    super()

    if (!context.nonStrict && !isUsableConfig(config)) throw new Error('non-usable configuration in strict mode')

    this._signers = signers.map(s => (AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s)))

    this.config = sortConfig(config)
    this.context = context
  }

  get address(): string {
    return addressOf(this.config, this.context)
  }

  get connected(): boolean {
    return this.sender !== undefined
  }

  async getSigners(): Promise<string[]> {
    return Promise.all(this._signers.map((s) => s.getAddress()))
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async chainId(): Promise<BigNumberish> {
    return (await this.provider.getNetwork()).chainId
  }

  async signWeight(): Promise<BigNumber> {
    const signers = await this.getSigners()
    return signers.reduce((p, s) => {
      const sconfig = this.config.signers.find((c) => c.address === s)
      if (!sconfig) return p
      return p.add(sconfig.weight)
    }, ethers.constants.Zero)
  }

  setProvider(provider: JsonRpcProvider | ConnectionInfo | string): ContractWallet {
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

  setRelayer(relayer: IRelayer): ContractWallet {
    this.relayer = relayer
    return this
  }

  useConfig(config: WalletConfig): ContractWallet {
    return new ContractWallet(config, this.context, ...this._signers)
      .setProvider(this.provider)
      .setRelayer(this.relayer)
  }

  connect(provider: Provider | ConnectionInfo | string, relayer?: IRelayer): ContractWallet {
    // TODO: This only works with JsonRpcProviders
    return new ContractWallet(this.config, this.context, ...this._signers).setProvider(provider as unknown as JsonRpcProvider).setRelayer(relayer)
  }

  async getNonce(blockTag?: BlockTag): Promise<number> {
    return this.relayer.getNonce(this.config, this.context, 0, blockTag)
  }

  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    return this.getNonce(blockTag)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, allSigners?: boolean): Promise<TransactionResponse> {
    const transaction = (await resolveArrayProperties<Transactionish>(dtransactionish))

    if (!this.provider) {
      throw new Error('missing provider')
    }
    if (!this.relayer) {
      throw new Error('missing relayer')
    }

    let arctx: SequenceTransaction[] = []

    if (Array.isArray(transaction)) {
      if (hasSequenceTransactions(transaction)) {
        arctx = transaction as SequenceTransaction[]
      } else {
        arctx = await toSequenceTransactions(this, transaction)
      }
    } else if (isSequenceTransaction(transaction)) {
      arctx = [transaction]
    } else {
      arctx = await toSequenceTransactions(this, [transaction])
    }

    // If transaction is marked as expirable
    // append expirable require
    if ((<AuxTransactionRequest>transaction).expiration) {
      arctx = makeExpirable(this.context, arctx, (<AuxTransactionRequest>transaction).expiration)
    }

    // If transaction depends on another nonce
    // append after nonce requirement
    if ((<AuxTransactionRequest>transaction).afterNonce) {
      const after = (<AuxTransactionRequest>transaction).afterNonce
      arctx = makeAfterNonce(this.context, arctx,
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
    if (arctx.find((a) => !a.revertOnError && ethers.BigNumber.from(a.gasLimit).eq(ethers.constants.Zero))) {
      arctx = await this.relayer.estimateGasLimits(this.config, this.context, ...arctx)
    }

    const providedNonce = readSequenceNonce(...arctx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    arctx = appendNonce(arctx, nonce)
    const signature = this.signTransactions(arctx, allSigners)
    return this.relayer.relay(this.config, this.context, signature, ...arctx)
  }

  async signTransactions(txs: SequenceTransaction[], allSigners?: boolean): Promise<string> {
    const packed = encodeMetaTransactionsData(...txs)
    return this.sign(packed, false, undefined, allSigners)
  }

  async signMessage(message: BytesLike, chainId?: number, allSigners?: boolean): Promise<string> {
    return this.sign(message, false, chainId, allSigners)
  }

  async sign(msg: BytesLike, isDigest: boolean = true, chainId?: number, allSigners?: boolean): Promise<string> {
    // TODO: chainId shouldn't be required to sign digest
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

  // buildUpdateConfig creates a transaction object of the an updated wallet config state update.
  async buildUpdateConfig(
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

  async updateConfig(
    config: WalletConfig,
    nonce?: number,
    publish = false
  ): Promise<[WalletConfig, TransactionResponse]> {
    const [txs, n] = await Promise.all([
      this.buildUpdateConfig(config, publish),
      nonce ? nonce : await this.getNonce()]
    )

    return [
      { address: this.address, ...config},
      await this.sendTransaction(appendNonce(txs, n))
    ]
  }

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

  private packMsgAndSig(msg: BytesLike, sig: BytesLike, chainId: BigNumberish): string {
    return ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes', 'bytes'], [this.address, chainId, msg, sig])
  }

  static async singleOwner(context: WalletContext, owner: BytesLike | AbstractSigner): Promise<ContractWallet> {
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

    return new ContractWallet(config, context, owner)
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }
}

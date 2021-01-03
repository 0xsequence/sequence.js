import {
  Provider,
  TransactionResponse,
  BlockTag,
  JsonRpcProvider
} from '@ethersproject/providers'
import { BigNumber, BigNumberish, ethers, Signer as AbstractSigner, Contract } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Interface } from '@ethersproject/abi'
import { BytesLike } from '@ethersproject/bytes'
import { Deferrable } from '@ethersproject/properties'
import { ConnectionInfo } from '@ethersproject/web'

import { walletContracts } from '@0xsequence/abi'

import {
  Transaction, Transactionish, TransactionRequest, NonceDependency,
  encodeMetaTransactionsData,
  isSequenceTransaction,
  readSequenceNonce,
  appendNonce,
  hasSequenceTransactions,
  toSequenceTransactions,
  sequenceTxAbiEncode,
  makeExpirable,
  makeAfterNonce,
  SignedTransactions
} from '@0xsequence/transactions'

import { Relayer } from '@0xsequence/relayer'

import { ChainId, WalletContext, JsonRpcSender, NetworkConfig, isNetworkConfig, isJsonRpcProvider, sequenceContext, getNetworkId } from '@0xsequence/network'

import {
  WalletConfig,
  WalletState,
  addressOf,
  sortConfig,
  compareAddr,
  imageHash,
  isUsableConfig,
  joinSignatures
} from './config'

import { RemoteSigner } from './remote-signers'

import { packMessageData, resolveArrayProperties } from './utils'

import { Signer } from './signer'
import { fetchImageHash } from '.'

// Wallet is a signer interface to a Smart Contract based Ethereum account.
//
// Wallet allows managing the account/wallet sub-keys, wallet address, signing
// messages, signing transactions and updating/deploying the wallet config on a specific chain.
//
// Wallet instances represent a wallet at a particular config-state, in someways, the Wallet
// instance is immutable, and if you update the config, then you'll need to call useConfig()
// to instantiate a new Wallet instance with the updated config.

export interface WalletOptions {
  // config is the wallet multi-sig configuration. Note: the first config of any wallet
  // before it is deployed is used to derive it's the account address of the wallet. 
  config: WalletConfig

  // context is the WalletContext of deployed wallet-contract modules for the Smart Wallet
  context?: WalletContext

  // strict mode will ensure the WalletConfig is usable otherwise throw (on by default)
  strict?: boolean
}

export class Wallet extends Signer {
  readonly context: WalletContext
  readonly config: WalletConfig

  private readonly _signers: AbstractSigner[]

  // provider is an Ethereum Json RPC provider that is connected to a particular network (aka chain)
  // and access to the signer for signing transactions.
  provider: JsonRpcProvider

  // sender is a minimal Json RPC sender interface. It's here for convenience for other web3
  // interfaces to use.
  sender: JsonRpcSender

  // relayer dispatches transactions to an Ethereum node directly
  // or through a remote transaction Web Service.
  relayer: Relayer

  constructor(options: WalletOptions, ...signers: (BytesLike | AbstractSigner)[]) {
    super()

    const { config, context, strict } = options

    if (context) {
      this.context = { ...context }
    } else {
      // default context is to use @0xsequence/network deployed context
      this.context = { ...sequenceContext }
    }

    if (strict === true) {
      this.context.nonStrict = undefined
    } else if (strict === false) {
      this.context.nonStrict = true
    }
    if (!this.context.nonStrict && !isUsableConfig(config)) {
      throw new Error('wallet config is not usable (strict mode)')
    }

    this.config = sortConfig(config)
    this._signers = signers.map(s => (AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s)))
  }

  // useConfig creates a new Wallet instance with the provided config, and uses the current provider
  // and relayer. It's common to initialize a counter-factual / undeployed wallet by initializing
  // it with the Wallet's init config, then calling useConfig() with the most-up-to-date config,
  // ie. new Wallet({ config: initConfig }).useConfig(latestConfig).useSigners(signers)
  useConfig(config: WalletConfig, strict?: boolean): Wallet {
    return new Wallet({ config, context: this.context, strict }, ...this._signers)
      .setProvider(this.provider)
      .setRelayer(this.relayer)
  }

  useSigners(...signers: (BytesLike | AbstractSigner)[]): Wallet {
    return new Wallet({ config: this.config, context: this.context }, ...signers)
      .setProvider(this.provider)
      .setRelayer(this.relayer)
  }

  // connect is a short-hand to create an Account instance and set the provider and relayer.
  //
  // The connect method is defined on the AbstractSigner as connect(Provider): AbstractSigner
  connect(provider: Provider, relayer?: Relayer): Wallet {
    if (isJsonRpcProvider(provider)) {
      return new Wallet({ config: this.config, context: this.context }, ...this._signers).setProvider(provider).setRelayer(relayer)
    } else {
      throw new Error('Wallet provider argument is expected to be a JsonRpcProvider')
    }
  }

  // setProvider assigns a json-rpc provider to this wallet instance
  setProvider(provider: JsonRpcProvider | ConnectionInfo | string): Wallet {
    if (provider === undefined) return this
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
    if (relayer === undefined) return this
    this.relayer = relayer
    return this
  }

  async getProvider(chainId?: number): Promise<JsonRpcProvider> {
    if (chainId) await this.getChainIdNumber(chainId)
    return this.provider
  }

  async getRelayer(chainId?: number): Promise<Relayer> {
    if (chainId) await this.getChainIdNumber(chainId)
    return this.relayer
  }

  async getWalletContext(): Promise<WalletContext> {
    return this.context
  }

  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> {
    if (chainId) await this.getChainIdNumber(chainId)
    return [this.config]
  }

  async getWalletState(_?: ChainId): Promise<WalletState[]> {
    const [address, chainId, isDeployed] = await Promise.all([
      this.getAddress(),
      this.chainId(),
      this.isDeployed()
    ])

    const state: WalletState = {
      context: this.context,
      config: this.config,
      address: address,
      chainId: chainId,
      deployed: isDeployed,
      imageHash: this.imageHash,
      currentImageHash: isDeployed ? await fetchImageHash(this) : undefined,
    }

    // TODO: check if its published

    return [state]
  }

  // connected reports if json-rpc provider has been connected
  get connected(): boolean {
    return this.sender !== undefined
  }

  // address returns the address of the wallet account address
  get address(): string {
    return addressOf(this.config, this.context)
  }

  // imageHash is the unique hash of the WalletConfig
  get imageHash(): string {
    return imageHash(sortConfig(this.config))
  }

  // getAddress returns the address of the wallet account address
  //
  // The getAddress method is defined on the AbstractSigner
  async getAddress(): Promise<string> {
    return this.address
  }

  // getSigners returns the list of public account addresses to the currently connected
  // signer objects for this wallet. Note: for a complete list of configured signers
  // on the wallet, query getWalletConfig()
  async getSigners(): Promise<string[]> {
    if (!this._signers || this._signers.length === 0) {
      return []
    }
    return Promise.all(this._signers.map(s => s.getAddress()))
  }

  // chainId returns the network connected to this wallet instance
  //
  // NOTE: AbstractSigner also offers getChainId(): Promise<number>
  async chainId(): Promise<number> {
    if (!this.provider) {
      throw new Error('provider is not set, first connect a provider')
    }
    return (await this.provider.getNetwork()).chainId
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    const chainId = await this.chainId()
    return [{
      chainId: chainId, name: '', rpcUrl: ''
    }]
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
  async sendTransaction(transaction: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<TransactionResponse> {
    return this.relayer.relay(await this.signTransactions(transaction, chainId, allSigners))
  }

  // signTransactions will sign a Sequence transaction with the wallet signers
  //
  // NOTE: the txs argument of type Transactionish can accept one or many transactions. 
  async signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    const signChainId = await this.getChainIdNumber(chainId)

    const transaction = (await resolveArrayProperties<Transactionish>(txs))

    if (!this.provider) {
      throw new Error('missing provider')
    }
    if (!this.relayer) {
      throw new Error('missing relayer')
    }

    let stx: Transaction[] = []

    if (Array.isArray(transaction)) {
      if (hasSequenceTransactions(transaction)) {
        stx = transaction as Transaction[]
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
    if ((<TransactionRequest>transaction).expiration) {
      stx = makeExpirable(this.context, stx, (<TransactionRequest>transaction).expiration)
    }

    // If transaction depends on another nonce
    // append after nonce requirement
    if ((<TransactionRequest>transaction).afterNonce) {
      const after = (<TransactionRequest>transaction).afterNonce
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

    // If provided nonce append it to all other transactions
    // otherwise get next nonce for this wallet
    const providedNonce = readSequenceNonce(...stx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    stx = appendNonce(stx, nonce)

    // Bundle with signature
    return {
      chainId: signChainId,
      context: this.context,
      config: this.config,
      transactions: stx,
      signature: await this.sign(encodeMetaTransactionsData(...stx), false, chainId, allSigners)
    }
  }

  async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    if (!this.relayer) {
      throw new Error('relayer is not set, first connect a relayer')
    }
    await this.getChainIdNumber(chainId)
    return this.relayer.relay(signedTxs)
  }

  // signMessage will sign a message for a particular chainId with the wallet signers
  //
  // NOTE: signMessage(message: Bytes | string): Promise<string> is defined on AbstractSigner
  async signMessage(message: BytesLike, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.sign(message, false, chainId, allSigners)
  }

  // ..
  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return ''
  }

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.signTypedData(domain, types, value, chainId, allSigners)
  }

  // sign is a helper method to sign a payload with the wallet signers
  async sign(msg: BytesLike, isDigest: boolean = true, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const signChainId = await this.getChainIdNumber(chainId)

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
    return joinSignatures(localSignature, remoteSignature)
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

  async isDeployed(chainId?: ChainId): Promise<boolean> {
    await this.getChainIdNumber(chainId)
    const walletCode = await this.provider.getCode(this.address)
    return walletCode && walletCode !== "0x"
  }

  // updateConfig will build an updated config transaction and send it to the Ethereum
  // network via the relayer. Note, the updated wallet config is stored as an image hash,
  // unlike `publishConfig` which will store the entire WalletConfig object in logs.
  async updateConfig(
    config?: WalletConfig,
    nonce?: number,
    publish = false
  ): Promise<[WalletConfig, TransactionResponse]> {
    if (!config) config = this.config

    const [txs, n] = await Promise.all([
      this.buildUpdateConfigTransaction(config, publish),
      nonce ? nonce : await this.getNonce()]
    )

    return [
      { address: this.address, ...config},
      await this.sendTransaction(appendNonce(txs, n))
    ]
  }

  // publishConfig will publish the current wallet config to the network via the relayer.
  // Publishing the config will also store the entire object of signers.
  async publishConfig(nonce?: number): Promise<TransactionResponse> {
    return this.sendTransaction(await this.buildPublishConfigTransaction(this.config, nonce))
  }

  // buildUpdateConfigTransaction creates a transaction to update the imageHash of the wallet's config
  // on chain. Note, the transaction is not sent to the network by this method.
  //
  // The `publish` argument when true will also store the contents of the WalletConfig to a chain's logs.
  async buildUpdateConfigTransaction(config: WalletConfig, publish = false): Promise<Transaction[]> {
    if (!this.context.nonStrict && !isUsableConfig(config)) throw new Error('wallet config is not usable (strict mode)')

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

    const postTransaction = publish ? this.buildPublishConfigTransaction(config) : []

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

  buildPublishConfigTransaction(config?: WalletConfig, nonce?: number): Transaction[] {
    const requireUtilsInterface = new Interface(walletContracts.requireUtils.abi)
    return [{
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.context.requireUtils,
      value: ethers.constants.Zero,
      nonce: nonce,
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
    }]
  }

  // getChainIdFromArgument will return the chainId of the argument, as well as ensure
  // we're not providing an invalid chainId that isn't connected to this wallet.
  private async getChainIdNumber(chainId?: ChainId): Promise<number> {
    if (!chainId) {
      // it's valid for chainId argument to be undefined, in which case
      // we will use the connected value
      return await this.chainId()
    }

    const id = getNetworkId(chainId)

    if (this.context.nonStrict) {
      // in non-strict mode, just return the chainId from argument
      return id
    }

    const connectedChainId = await this.chainId()
    if (connectedChainId !== id) {
      throw new Error(`the specified chainId ${id} does not match the wallet's connected chainId ${connectedChainId}`)
    }

    return connectedChainId
  }

  // packMsgAndSig is used by RemoteSigners to include details as a string blob of data.
  private packMsgAndSig(msg: BytesLike, sig: BytesLike, chainId: BigNumberish): string {
    return ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes', 'bytes'], [this.address, chainId, msg, sig])
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in Wallet, please use signTransactions(...)')
  }

  // singleOwner will create a Wallet instance with a single signer (ie. from a single EOA account)
  static async singleOwner(owner: BytesLike | AbstractSigner, context?: WalletContext): Promise<Wallet> {
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
    return new Wallet({ config, context }, signer)
  }
}

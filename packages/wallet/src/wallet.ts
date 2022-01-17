import { Provider, TransactionResponse, BlockTag, JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, BigNumberish, ethers, Signer as AbstractSigner } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { BytesLike } from '@ethersproject/bytes'
import { Deferrable } from '@ethersproject/properties'
import { ConnectionInfo } from '@ethersproject/web'

import {
  Transaction,
  Transactionish,
  TransactionRequest,
  readSequenceNonce,
  appendNonce,
  SignedTransactions,
  computeMetaTxnHash,
  digestOfTransactionsNonce,
  decodeNonce,
  fromTransactionish
} from '@0xsequence/transactions'

import { Relayer } from '@0xsequence/relayer'

import {
  ChainIdLike,
  WalletContext,
  JsonRpcSender,
  NetworkConfig,
  isJsonRpcProvider,
  sequenceContext,
  getChainId
} from '@0xsequence/network'

import {
  WalletConfig,
  WalletState,
  addressOf,
  sortConfig,
  imageHash,
  isUsableConfig,
  DecodedSignature,
  encodeSignature,
  joinSignatures,
  recoverEOASigner,
} from '@0xsequence/config'

import { encodeTypedDataDigest, subDigestOf } from '@0xsequence/utils'
import { RemoteSigner } from './remote-signers'
import { resolveArrayProperties } from './utils'
import { isSequenceSigner, Signer, SignedTransactionsCallback } from './signer'

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

  // chainId is the node network id, used for memoization
  chainId?: number

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
      return new Wallet({ config: this.config, context: this.context }, ...this._signers)
        .setProvider(provider)
        .setRelayer(relayer!)
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
    this.chainId = undefined // reset chainId value
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

  async getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig> {
    chainId = await this.getChainIdNumber(chainId)
    const config = {
      ...this.config,
      chainId
    }
    return config
  }

  async getWalletState(_?: ChainIdLike): Promise<WalletState> {
    const [address, chainId, isDeployed] = await Promise.all([this.getAddress(), this.getChainId(), this.isDeployed()])

    const state: WalletState = {
      context: this.context,
      config: this.config,
      address: address,
      chainId: chainId,
      deployed: isDeployed,
      imageHash: this.imageHash,
    }

    return state
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
    return imageHash(this.config)
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
  async getSigners(): Promise<string[]> {
    if (!this._signers || this._signers.length === 0) {
      return []
    }
    return Promise.all(this._signers.map(s => s.getAddress().then(s => ethers.utils.getAddress(s))))
  }

  // chainId returns the network connected to this wallet instance
  async getChainId(): Promise<number> {
    if (this.chainId) return this.chainId
    if (!this.provider) {
      throw new Error('provider is not set, first connect a provider')
    }

    this.chainId = (await this.provider.getNetwork()).chainId
    return this.chainId
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    const chainId = await this.getChainId()
    return [
      {
        chainId: chainId,
        name: '',
        rpcUrl: ''
      }
    ]
  }

  // getNonce returns the transaction nonce for this wallet, via the relayer
  async getNonce(blockTag?: BlockTag, space?: BigNumberish): Promise<BigNumberish> {
    return this.relayer.getNonce(this.config, this.context, space, blockTag)
  }

  // getTransactionCount returns the number of transactions (aka nonce)
  //
  // getTransactionCount method is defined on the AbstractSigner
  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    const encodedNonce = await this.getNonce(blockTag, 0)
    const [_, decodedNonce] = decodeNonce(encodedNonce)
    return ethers.BigNumber.from(decodedNonce).toNumber()
  }

  // sendTransaction will dispatch the transaction to the relayer for submission to the network.
  async sendTransaction(
    transaction: Deferrable<Transactionish>,
    chainId?: ChainIdLike,
    allSigners?: boolean,
    callback?: SignedTransactionsCallback
  ): Promise<TransactionResponse> {
    const signedTxs = await this.signTransactions(transaction, chainId, allSigners)
    if (callback) {
      const address = addressOf(signedTxs.config, signedTxs.context)
      const metaTxnHash = computeMetaTxnHash(address, signedTxs.chainId, ...signedTxs.transactions)
      callback(signedTxs, metaTxnHash)
    }
    return this.relayer.relay(signedTxs)
  }

  // sendTransactionBatch is a sugar for better readability, but is the same as sendTransaction
  async sendTransactionBatch(
    transactions: Deferrable<TransactionRequest[] | Transaction[]>,
    chainId?: ChainIdLike,
    allSigners: boolean = true,
    callback?: SignedTransactionsCallback
  ): Promise<TransactionResponse> {
    return this.sendTransaction(transactions, chainId, allSigners, callback)
  }

  // signTransactions will sign a Sequence transaction with the wallet signers
  //
  // NOTE: the txs argument of type Transactionish can accept one or many transactions.
  async signTransactions(
    txs: Deferrable<Transactionish>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<SignedTransactions> {
    const signChainId = await this.getChainIdNumber(chainId)

    const transaction = await resolveArrayProperties<Transactionish>(txs)

    if (!this.provider) {
      throw new Error('missing provider')
    }
    if (!this.relayer) {
      throw new Error('missing relayer')
    }

    // Convert Transactionish into Sequence transactions
    let stx = await fromTransactionish(this.context, this.address, transaction)

    // If a transaction has 0 gasLimit and not revertOnError
    // compute all new gas limits
    if (stx.find(a => !a.revertOnError && ethers.BigNumber.from(a.gasLimit || 0).eq(ethers.constants.Zero))) {
      stx = await this.relayer.estimateGasLimits(this.config, this.context, ...stx)
    }

    // If provided nonce append it to all other transactions
    // otherwise get next nonce for this wallet
    const providedNonce = readSequenceNonce(...stx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    stx = appendNonce(stx, nonce)

    // Get transactions digest
    const digest = digestOfTransactionsNonce(nonce, ...stx)

    // Bundle with signature
    return {
      digest: digest,
      chainId: signChainId,
      context: this.context,
      config: this.config,
      transactions: stx,
      nonce,
      signature: await this.sign(digest, true, chainId, allSigners)
    }
  }

  async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainIdLike): Promise<TransactionResponse> {
    if (!this.relayer) {
      throw new Error('relayer is not set, first connect a relayer')
    }
    await this.getChainIdNumber(chainId)
    return this.relayer.relay(signedTxs)
  }

  // signMessage will sign a message for a particular chainId with the wallet signers
  //
  // NOTE: signMessage(message: Bytes | string): Promise<string> is defined on AbstractSigner
  async signMessage(message: BytesLike, chainId?: ChainIdLike, allSigners?: boolean, isDigest: boolean = false): Promise<string> {
    const data = typeof message === 'string' && !message.startsWith('0x') ? ethers.utils.toUtf8Bytes(message) : message
    return this.sign(data, isDigest, chainId, allSigners)
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    const signChainId = await this.getChainIdNumber(chainId)

    const domainChainId = domain.chainId ? BigNumber.from(domain.chainId).toNumber() : undefined
    if (domainChainId && domainChainId !== signChainId) {
      throw new Error(`signTypedData: domain.chainId (${domain.chainId}) is expected to be ${signChainId}`)
    }

    const hash = encodeTypedDataDigest({ domain, types, message })
    return this.sign(hash, true, signChainId, allSigners)
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    return this.signTypedData(domain, types, message, chainId, allSigners)
  }

  async subDigest(digest: BytesLike, chainId?: ChainIdLike): Promise<Uint8Array> {
    const solvedChainId = await this.getChainIdNumber(chainId)
    return ethers.utils.arrayify(subDigestOf(this.address, solvedChainId, digest))
  }

  // sign is a helper method to sign a payload with the wallet signers
  async sign(msg: BytesLike, isDigest: boolean = true, chainId?: ChainIdLike, allSigners?: boolean): Promise<string> {
    const signChainId = await this.getChainIdNumber(chainId)

    const digest = isDigest ? msg : ethers.utils.keccak256(msg)

    // Generate sub-digest
    const subDigest = await this.subDigest(digest, chainId)

    // Sign sub-digest using a set of signers and some optional data
    const signWith = async (signers: AbstractSigner[], auxData?: string): Promise<DecodedSignature> => {
      const signersAddr = await Promise.all(signers.map(s => s.getAddress()))
      const parts = await Promise.all(
        this.config.signers.map(async s => {
          try {
            const signer = signers[signersAddr.indexOf(s.address)]

            // Is not a signer, return config entry as-is
            if (!signer) {
              return s
            }

            // Is another Sequence wallet as signer, sign and append '03' (ERC1271 type)
            if (isSequenceSigner(signer)) {
              if (signer === this) throw Error("Can't sign transactions for self")
              const signature = (await signer.signMessage(subDigest, signChainId, allSigners, true)) + '03'

              return {
                ...s,
                signature: signature
              }
            }

            // Is remote signer, call and deduce signature type
            if (RemoteSigner.isRemoteSigner(signer)) {
              const signature = await signer.signMessageWithData(subDigest, auxData, signChainId)

              try {
                // Check if signature can be recovered as EOA signature
                const isEOASignature = recoverEOASigner(subDigest, { weight: s.weight, signature: signature }) === s.address

                if (isEOASignature) {
                  // Exclude address on EOA signatures
                  return {
                    weight: s.weight,
                    signature: signature
                  }
                }
              } catch {}

              // Prepare signature for full encoding
              return {
                ...s,
                signature: signature
              }
            }

            // Is EOA signer
            return {
              weight: s.weight,
              signature: (await signer.signMessage(subDigest)) + '02'
            }
          } catch (err) {
            if (allSigners) {
              throw err
            } else {
              console.warn(`Skipped signer ${s.address}`)
              return s
            }
          }
        })
      )

      return {
        threshold: this.config.threshold,
        signers: parts
      }
    }

    // Split local signers and remote signers
    const localSigners = this._signers.filter(s => !RemoteSigner.isRemoteSigner(s))
    const remoteSigners = this._signers.filter(s => RemoteSigner.isRemoteSigner(s))

    // Sign message first using localSigners
    // include local signatures for remote signers
    const localSignature = await signWith(localSigners, this.packMsgAndSig(digest, [], signChainId))
    const remoteSignature = await signWith(
      remoteSigners,
      this.packMsgAndSig(digest, encodeSignature(localSignature), signChainId)
    )

    // Aggregate both local and remote signatures
    return encodeSignature(joinSignatures(localSignature, remoteSignature))
  }

  // signWeight will return the total weight of all signers available based on the config
  async signWeight(): Promise<BigNumber> {
    const signers = await this.getSigners()
    return signers.reduce((p, s) => {
      const sconfig = this.config.signers.find(c => c.address === s)
      if (!sconfig) return p
      return p.add(sconfig.weight)
    }, ethers.constants.Zero)
  }

  async isDeployed(chainId?: ChainIdLike): Promise<boolean> {
    await this.getChainIdNumber(chainId)
    const walletCode = await this.provider.getCode(this.address)
    return !!walletCode && walletCode !== '0x'
  }

  // getChainIdFromArgument will return the chainId of the argument, as well as ensure
  // we're not providing an invalid chainId that isn't connected to this wallet.
  private async getChainIdNumber(chainId?: ChainIdLike): Promise<number> {
    if (!chainId) {
      // it's valid for chainId argument to be undefined, in which case
      // we will use the connected value
      return await this.getChainId()
    }

    const id = getChainId(chainId)

    if (this.context.nonStrict) {
      // in non-strict mode, just return the chainId from argument
      return id
    }

    const connectedChainId = await this.getChainId()
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
          address: ethers.utils.getAddress(await signer.getAddress())
        }
      ]
    }
    return new Wallet({ config, context }, signer)
  }

  async hasEnoughSigners(chainId?: ChainIdLike): Promise<boolean> {
    if (chainId) await this.getChainIdNumber(chainId)
    return (await this.signWeight()).gte(this.config.threshold)
  }
}

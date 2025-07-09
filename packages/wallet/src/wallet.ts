import { ethers } from 'ethers'
import { commons, v1, v2 } from '@0xsequence/core'
import { ChainId } from '@0xsequence/network'
import { SignatureOrchestrator, SignerState, Status } from '@0xsequence/signhub'
import { encodeTypedDataDigest, subDigestOf } from '@0xsequence/utils'
import { FeeQuote, Relayer } from '@0xsequence/relayer'
import { walletContracts } from '@0xsequence/abi'

import { resolveArrayProperties } from './utils'

export type WalletOptions<
  T extends commons.signature.Signature<Y>,
  Y extends commons.config.Config,
  Z extends commons.signature.UnrecoveredSignature
> = {
  // Sequence version configurator
  coders: {
    config: commons.config.ConfigCoder<Y>
    signature: commons.signature.SignatureCoder<Y, T, Z>
  }

  context: commons.context.WalletContext
  config: Y

  chainId: ethers.BigNumberish
  address: string

  orchestrator: SignatureOrchestrator
  reader?: commons.reader.Reader

  provider?: ethers.Provider
  relayer?: Relayer
}

const statusToSignatureParts = (status: Status) => {
  const parts = new Map<string, commons.signature.SignaturePart>()

  for (const signer of Object.keys(status.signers)) {
    const value = status.signers[signer]
    if (value.state === SignerState.SIGNED) {
      const suffix = ethers.getBytes(value.suffix)
      const suffixed = ethers.solidityPacked(['bytes', 'bytes'], [value.signature, suffix])

      parts.set(signer, { signature: suffixed, isDynamic: suffix.length !== 1 || suffix[0] !== 2 })
    }
  }

  return parts
}

export type WalletV2 = Wallet<v2.config.WalletConfig, v2.signature.Signature, v2.signature.UnrecoveredSignature>
export type WalletV1 = Wallet<v1.config.WalletConfig, v1.signature.Signature, v1.signature.UnrecoveredSignature>

/**
 * The wallet is the minimum interface to interact with a single Sequence wallet/contract.
 * it doesn't have any knowledge of any on-chain state, instead it relies solely on the information
 * provided by the user. This building block is used to create higher level abstractions.
 *
 * Wallet can also be used to create Sequence wallets, but it's not recommended to use it directly.
 */
export class Wallet<
  Y extends commons.config.Config = commons.config.Config,
  T extends commons.signature.Signature<Y> = commons.signature.Signature<Y>,
  Z extends commons.signature.UnrecoveredSignature = commons.signature.UnrecoveredSignature
> extends ethers.AbstractSigner {
  public context: commons.context.WalletContext
  public config: Y
  public address: string
  public chainId: bigint

  public relayer?: Relayer

  public coders: {
    signature: commons.signature.SignatureCoder<Y, T, Z>
    config: commons.config.ConfigCoder<Y>
  }

  private orchestrator: SignatureOrchestrator
  private _reader?: commons.reader.Reader

  constructor(options: WalletOptions<T, Y, Z>) {
    const chainId = BigInt(options.chainId)

    if (chainId === 0n && !options.coders.signature.supportsNoChainId) {
      throw new Error(`Sequence version ${options.config.version} doesn't support chainId 0`)
    }

    super(options.provider ?? null)

    this.context = options.context
    this.config = options.config
    this.orchestrator = options.orchestrator
    this.coders = options.coders
    this.address = options.address
    this.chainId = chainId
    this.relayer = options.relayer

    this._reader = options.reader
  }

  static newWallet<
    Y extends commons.config.Config = commons.config.Config,
    T extends commons.signature.Signature<Y> = commons.signature.Signature<Y>,
    Z extends commons.signature.UnrecoveredSignature = commons.signature.UnrecoveredSignature
  >(options: Omit<WalletOptions<T, Y, Z>, 'address'>): Wallet<Y, T, Z> {
    const address = commons.context.addressOf(options.context, options.coders.config.imageHashOf(options.config))
    return new Wallet({ ...options, address })
  }

  reader(): commons.reader.Reader {
    if (this._reader) return this._reader
    if (!this.provider) throw new Error('Wallet status provider requires a provider')
    return new commons.reader.OnChainReader(this.provider)
  }

  setConfig(config: Y) {
    this.config = config
  }

  setOrchestrator(orchestrator: SignatureOrchestrator) {
    this.orchestrator = orchestrator
  }

  setAddress(address: string) {
    this.address = address
  }

  getSigners(): Promise<string[]> {
    return this.orchestrator.getSigners()
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    // Allow children to decorate
    const decorated = await this.orchestrator.decorateTransactions(bundle)

    if (await this.reader().isDeployed(this.address)) {
      // Deployed - No decorating at this level
      return decorated
    }

    const transactions: commons.transaction.Transaction[] = [
      {
        to: decorated.entrypoint,
        data: commons.transaction.encodeBundleExecData(decorated),
        revertOnError: true
      }
    ]

    // Add deployment tx
    const deployTx = await this.buildDeployTransaction()
    if (deployTx) {
      transactions.unshift(...deployTx.transactions)
    }

    // TODO: If entrypoint is guestModule we can flatten the bundle
    // and avoid calling guestModule twice

    return {
      entrypoint: this.context.guestModule,
      chainId: this.chainId,
      intent: decorated.intent,
      transactions
    }
  }

  async buildDeployTransaction(
    metadata?: commons.WalletDeployMetadata
  ): Promise<commons.transaction.TransactionBundle | undefined> {
    if (metadata?.ignoreDeployed && (await this.reader().isDeployed(this.address))) {
      return
    }

    const imageHash = this.coders.config.imageHashOf(this.config)

    if (commons.context.addressOf(this.context, imageHash) !== this.address) {
      throw new Error(`First address of config ${imageHash} doesn't match wallet address ${this.address}`)
    }

    let gasLimit: bigint | undefined
    switch (this.chainId) {
      case BigInt(ChainId.SKALE_NEBULA):
        gasLimit = 10000000n
        break
      case BigInt(ChainId.SOMNIA_TESTNET):
        gasLimit = 10000000n
        break
      case BigInt(ChainId.SOMNIA):
        gasLimit = 10000000n
        break
    }

    const bundle = Wallet.buildDeployTransaction(this.context, imageHash, gasLimit)
    if (metadata?.includeChildren) {
      const childBundle = await this.orchestrator.buildDeployTransaction(metadata)
      if (childBundle) {
        // Deploy children first
        bundle.transactions = childBundle.transactions.concat(bundle.transactions)
      }
    }
    return bundle
  }

  async deploy(metadata?: commons.WalletDeployMetadata): Promise<ethers.TransactionResponse | undefined> {
    const deployTx = await this.buildDeployTransaction(metadata)
    if (deployTx === undefined) {
      // Already deployed
      return
    }
    if (!this.relayer) throw new Error('Wallet deploy requires a relayer')
    return this.relayer.relay({
      ...deployTx,
      chainId: this.chainId,
      intent: {
        id: ethers.hexlify(ethers.randomBytes(32)),
        wallet: this.address
      }
    })
  }

  static buildDeployTransaction(
    context: commons.context.WalletContext,
    imageHash: string,
    gasLimit: ethers.BigNumberish = 100000n
  ): commons.transaction.TransactionBundle {
    const factoryInterface = new ethers.Interface(walletContracts.factory.abi)

    return {
      entrypoint: context.guestModule,
      transactions: [
        {
          to: context.factory,
          data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy')!, [context.mainModule, imageHash]),
          gasLimit,
          delegateCall: false,
          revertOnError: true,
          value: 0
        }
      ]
    }
  }

  async buildUpdateConfigurationTransaction(config: Y): Promise<commons.transaction.TransactionBundle> {
    if (this.coders.config.update.isKindUsed) {
      const implementation = await this.reader().implementation(this.address)
      const isLaterUpdate = implementation && implementation === this.context.mainModuleUpgradable
      return this.coders.config.update.buildTransaction(this.address, config, this.context, isLaterUpdate ? 'later' : 'first')
    }

    return this.coders.config.update.buildTransaction(this.address, config, this.context)
  }

  async getNonce(space: ethers.BigNumberish = 0): Promise<number> {
    const nonce = await this.reader().nonce(this.address, space)
    if (nonce === undefined) throw new Error('Unable to determine nonce')
    return Number(nonce)
  }

  async signDigest(digest: ethers.BytesLike, metadata?: object): Promise<string> {
    // The subdigest may be statically defined on the configuration
    // in that case we just encode the proof, no need to sign anything
    const subdigest = subDigestOf(this.address, this.chainId, digest)
    if (this.coders.config.hasSubdigest(this.config, subdigest)) {
      return this.coders.signature.encodeSigners(this.config, new Map(), [subdigest], this.chainId).encoded
    }

    // We build the metadata object, this contains additional information
    // that may be needed to sign the digest (by the other signers, or by the guard)
    const childMetadata: commons.WalletSignRequestMetadata = {
      ...metadata, // Keep other metadata fields
      digest,
      chainId: this.chainId,
      address: this.address,
      config: this.config
    }

    // We ask the orchestrator to sign the digest, as soon as we have enough signature parts
    // to reach the threshold we returns true, that means the orchestrator will stop asking
    // and we can encode the final signature
    const subdigestBytes = ethers.getBytes(subdigest)
    const signature = await this.orchestrator.signMessage({
      candidates: this.coders.config.signersOf(this.config).map(s => s.address),
      message: subdigestBytes,
      metadata: childMetadata,
      callback: (status: Status, onNewMetadata: (_metadata: object) => void): boolean => {
        const parts = statusToSignatureParts(status)

        const newMetadata = { ...childMetadata, parts }
        onNewMetadata(newMetadata)

        return this.coders.signature.hasEnoughSigningPower(this.config, parts)
      }
    })

    const parts = statusToSignatureParts(signature)
    return this.coders.signature.encodeSigners(this.config, parts, [], this.chainId).encoded
  }

  signMessage(message: ethers.BytesLike): Promise<string> {
    return this.signDigest(ethers.keccak256(message), { message })
  }

  // XXX This method is not implemented in the original code but required by the AbstractSigner interface
  signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    const digest = encodeTypedDataDigest({ domain, types, message: value })
    return this.signDigest(digest)
  }

  signTransactionBundle(bundle: commons.transaction.TransactionBundle): Promise<commons.transaction.SignedTransactionBundle> {
    if (bundle.entrypoint !== this.address) {
      throw new Error(`Invalid entrypoint: ${bundle.entrypoint} !== ${this.address}`)
    }

    return this.signTransactions(bundle.transactions, bundle.nonce)
  }

  async fetchNonceOrSpace(
    nonce?: ethers.BigNumberish | { space: ethers.BigNumberish } | { serial: boolean }
  ): Promise<ethers.BigNumberish> {
    let spaceValue

    if (nonce && (nonce as any).space !== undefined) {
      // specified nonce "space"
      spaceValue = BigInt((nonce as any).space)
    } else if (nonce === undefined) {
      // default is random, aka parallel
      return this.randomNonce()
    } else if (nonce && (nonce as any).serial === true) {
      // next nonce determined from the chain
      spaceValue = 0
    } else {
      // specific nonce is used
      return nonce as ethers.BigNumberish
    }

    const resultNonce = await this.reader().nonce(this.address, spaceValue)
    if (resultNonce === undefined) throw new Error('Unable to determine nonce')
    return commons.transaction.encodeNonce(spaceValue, resultNonce)
  }

  // Generate nonce with random space
  randomNonce(): ethers.BigNumberish {
    const randomNonceSpace = BigInt(ethers.hexlify(ethers.randomBytes(12)))
    const randomNonce = commons.transaction.encodeNonce(randomNonceSpace, 0)
    return randomNonce
  }

  async signTransactions(
    txs: commons.transaction.Transactionish,
    nonce?: ethers.BigNumberish | { space: ethers.BigNumberish } | { serial: boolean },
    metadata?: object
  ): Promise<commons.transaction.SignedTransactionBundle> {
    const transaction = await resolveArrayProperties<commons.transaction.Transactionish>(txs)
    const transactions = commons.transaction.fromTransactionish(this.address, transaction)

    // NOTICE: If the `transactions` list is empty, then we add a dummy transaction
    // otherwise the `TxExecuted` event will not be emitted, and we won't be able to
    // find the transaction hash
    if (transactions.length === 0) {
      transactions.push({
        to: this.address,
        data: '0x',
        value: 0,
        gasLimit: 0,
        delegateCall: false,
        revertOnError: true
      })
    }

    const defaultedNonce = await this.fetchNonceOrSpace(nonce)
    const digest = commons.transaction.digestOfTransactions(defaultedNonce, transactions)
    const meta = {
      digest,
      transactions,
      ...metadata
    }
    const signature = await this.signDigest(digest, meta)

    return {
      intent: {
        // Maybe is better if signDigest returns the subdigest directly
        id: subDigestOf(this.address, this.chainId, digest),
        wallet: this.address
      },
      chainId: this.chainId,
      transactions,
      entrypoint: this.address,
      nonce: defaultedNonce,
      signature
    }
  }

  async sendSignedTransaction(
    signedBundle: commons.transaction.IntendedTransactionBundle,
    quote?: FeeQuote
  ): Promise<ethers.TransactionResponse> {
    if (!this.relayer) throw new Error('Wallet sendTransaction requires a relayer')
    return this.relayer.relay(signedBundle, quote)
  }

  // sendTransaction will dispatch the transaction to the relayer for submission to the network.
  // This method is able to send transactions in serial or parallel (default). You can specify
  // a specific nonce, or let the wallet determine the next nonce on-chain (serial:true).
  //
  // By default, nonces are generated randomly and assigned so transactioned can be executed
  // in parallel. However, if you'd like to execute serially, pass { serial: true } as an option.
  async sendTransaction(
    txs: commons.transaction.Transactionish,
    options?: {
      quote?: FeeQuote
      nonce?: ethers.BigNumberish
      serial?: boolean
    }
  ): Promise<ethers.TransactionResponse> {
    let nonce: ethers.BigNumberish | { serial: boolean }
    if (options?.nonce !== undefined) {
      // specific nonce is used
      nonce = options.nonce
    } else if (options?.serial) {
      // next nonce on wallet is used and detected on-chain
      nonce = { serial: true }
    } else {
      // default is random, aka parallel
      nonce = this.randomNonce()
    }

    const signed = await this.signTransactions(txs, nonce)
    const decorated = await this.decorateTransactions(signed)
    return this.sendSignedTransaction(decorated, options?.quote)
  }

  async fillGasLimits(txs: commons.transaction.Transactionish): Promise<commons.transaction.SimulatedTransaction[]> {
    const transaction = await resolveArrayProperties<commons.transaction.Transactionish>(txs)
    const transactions = commons.transaction.fromTransactionish(this.address, transaction)
    const relayer = this.relayer
    if (!relayer) throw new Error('Wallet fillGasLimits requires a relayer')

    const simulations = await relayer.simulate(this.address, ...transactions)
    return transactions.map((tx, i) => {
      const gasLimit = tx.gasLimit ? Number(tx.gasLimit) : simulations[i].gasLimit
      return { ...tx, ...simulations[i], gasLimit }
    })
  }

  connect(provider: ethers.Provider, relayer?: Relayer): Wallet<Y, T, Z> {
    return new Wallet({
      // Sequence version configurator
      coders: this.coders,

      context: this.context,
      config: this.config,

      chainId: this.chainId,
      address: this.address,

      orchestrator: this.orchestrator,
      reader: this._reader,

      provider,
      relayer: relayer ?? this.relayer
    })
  }

  signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    throw new Error('Method not implemented.')
  }
}

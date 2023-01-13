import { ethers } from "ethers"
import { commons, v1, v2 } from "@0xsequence/core"
import { isSignerStatusSigned, Orchestrator, Status } from "@0xsequence/signhub"
import { Deferrable, subDigestOf } from "@0xsequence/utils"
import { FeeQuote, Relayer } from "@0xsequence/relayer"
import { walletContracts } from '@0xsequence/abi'

import { resolveArrayProperties } from "./utils"

export type WalletOptions<
  T extends commons.signature.Signature<Y>,
  Y extends commons.config.Config,
  Z extends commons.signature.UnrecoveredSignature
> = {
  // Sequence version configurator
  coders: {
    config: commons.config.ConfigCoder<Y>,
    signature: commons.signature.SignatureCoder<Y, T, Z>
  }

  context: commons.context.WalletContext,
  config: Y,

  chainId: ethers.BigNumberish,
  address: string

  orchestrator: Orchestrator
  reader?: commons.reader.Reader

  provider?: ethers.providers.Provider
  relayer?: Relayer
}

const statusToSignatureParts = (status: Status) => {
  const parts = new Map<string, commons.signature.SignaturePart>()

  for (const signer of Object.keys(status.signers)) {
    const value = status.signers[signer]
    if (isSignerStatusSigned(value)) {
      // Suffix is 0x02 if EOA or 0x03 if contract
      // TODO: Maybe this should be moved to a different function that
      // only handles suffixes
      const suffixed = ethers.utils.solidityPack(
        ['bytes', 'uint8'],
        [value.signature, value.isEOA ? 0x02 : 0x03]
      )

      parts.set(signer, { signature: suffixed, isDynamic: !value.isEOA })
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
 * Wallet can also be used to create Sequence wallets, but it's not recommended to use it directly
 * 
 * @notice: TODO: This class is meant to replace the one in ../wallet.ts !!!
 * 
 */
export class Wallet<
  Y extends commons.config.Config = commons.config.Config,
  T extends commons.signature.Signature<Y> = commons.signature.Signature<Y>,
  Z extends commons.signature.UnrecoveredSignature = commons.signature.UnrecoveredSignature
> extends ethers.Signer {
  public context: commons.context.WalletContext
  public config: Y
  public address: string
  public chainId: ethers.BigNumberish

  public provider?: ethers.providers.Provider
  public relayer?: Relayer

  public coders: {
    signature: commons.signature.SignatureCoder<Y, T, Z>
    config: commons.config.ConfigCoder<Y>
  }

  private orchestrator: Orchestrator
  private _reader?: commons.reader.Reader

  constructor(options: WalletOptions<T, Y, Z>) {  
    if (ethers.constants.Zero.eq(options.chainId) && !options.coders.signature.supportsNoChainId) {
      throw new Error(`Sequence version ${options.config.version} doesn't support chainId 0`)
    }

    super()

    this.context = options.context
    this.config = options.config
    this.orchestrator = options.orchestrator
    this.coders = options.coders
    this.address = options.address
    this.chainId = options.chainId
    this.provider = options.provider
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
    if (!this.provider) throw new Error("Wallet status provider requires a provider")
    return new commons.reader.OnChainReader(this.provider)
  }

  setConfig(config: Y) {
    this.config = config
  }

  setOrchestrator(orchestrator: Orchestrator) {
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
    if (await this.reader().isDeployed(this.address)) return bundle

    const deployTx = this.buildDeployTransaction()

    // TODO: If entrypoint is guestModule we can flatten the bundle
    // and avoid calling guestModule twice

    return {
      entrypoint: this.context.guestModule,
      chainId: this.chainId,
      intent: bundle.intent,
      transactions: [
        ...deployTx.transactions,
        {
          to: bundle.entrypoint,
          data: commons.transaction.encodeBundleExecData(bundle),
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        }
      ]
    }
  }

  buildDeployTransaction(): commons.transaction.TransactionBundle {
    const imageHash = this.coders.config.imageHashOf(this.config)

    if (commons.context.addressOf(this.context, imageHash) !== this.address) {
      throw new Error(`First address of config ${imageHash} doesn't match wallet address ${this.address}`)
    }

    return Wallet.buildDeployTransaction(this.context, imageHash)
  }

  static buildDeployTransaction(
    context: commons.context.WalletContext,
    imageHash: string,
  ): commons.transaction.TransactionBundle {
    const factoryInterface = new ethers.utils.Interface(walletContracts.factory.abi)

    return {
      entrypoint: context.guestModule,
      transactions: [{
        to: context.factory,
        data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy'),
          [context.mainModule, imageHash]
        ),
        gasLimit: 100000,
        delegateCall: false,
        revertOnError: true,
        value: 0
      }]
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

  async signDigest(digest: ethers.utils.BytesLike): Promise<string> {
    // The subdigest may be statically defined on the configuration
    // in that case we just encode the proof, no need to sign anything
    const subdigest = subDigestOf(this.address, this.chainId, digest)
    if (this.coders.config.hasSubdigest(this.config, subdigest)) {
      return this.coders.signature.encodeSigners(this.config, new Map(), [subdigest], this.chainId).encoded
    }

    // We ask the orchestrator to sign the digest, as soon as we have enough signature parts
    // to reach the threshold we returns true, that means the orchestrator will stop asking
    // and we can encode the final signature
    const subdigestBytes = ethers.utils.arrayify(subdigest)
    const signature = await this.orchestrator.signMessage(subdigestBytes, (status: Status): boolean => {
      const parts = statusToSignatureParts(status)
      return this.coders.signature.hasEnoughSigningPower(this.config, parts)
    })

    const parts = statusToSignatureParts(signature)
    return this.coders.signature.encodeSigners(this.config, parts, [], this.chainId).encoded
  }

  signMessage(message: ethers.BytesLike): Promise<string> {
    return this.signDigest(ethers.utils.keccak256(message))
  }

  signTransactionBundle(bundle: commons.transaction.TransactionBundle): Promise<commons.transaction.SignedTransactionBundle> {
    if (bundle.entrypoint !== this.address) {
      throw new Error(`Invalid entrypoint: ${bundle.entrypoint} !== ${this.address}`)
    }

    return this.signTransactions(bundle.transactions, bundle.nonce)
  }

  async signTransactions(txs: Deferrable<commons.transaction.Transactionish>, nonce?: ethers.BigNumberish): Promise<commons.transaction.SignedTransactionBundle> {
    const transaction = await resolveArrayProperties<commons.transaction.Transactionish>(txs)

    const transactions = commons.transaction.fromTransactionish(this.address, transaction)

    let defaultedNonce = nonce
    if (defaultedNonce === undefined) {
      defaultedNonce = await this.reader().nonce(this.address, 0)
      if (defaultedNonce === undefined) throw new Error("Unable to determine nonce")
    }

    const digest = commons.transaction.digestOfTransactions(defaultedNonce, transactions)
    const signature = await this.signDigest(digest)

    return {
      intent: {
        id: digest,
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
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this.relayer) throw new Error("Wallet sendTransaction requires a relayer")
    return this.relayer.relay(signedBundle, quote)
  }

  async sendTransaction(
    txs: Deferrable<commons.transaction.Transactionish>,
    nonce?: ethers.BigNumberish,
    quote?: FeeQuote
  ): Promise<ethers.providers.TransactionResponse> {
    const signed = await this.signTransactions(txs, nonce)
    const decorated = await this.decorateTransactions(signed)
    return this.sendSignedTransaction(decorated, quote)
  }

  connect(provider: ethers.providers.Provider, relayer?: Relayer): Wallet<Y, T, Z> {
    this.provider = provider
    this.relayer = relayer
    return this
  }

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    throw new Error("Method not implemented.");
  }
}

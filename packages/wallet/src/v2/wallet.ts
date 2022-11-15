import { ethers } from "ethers"
import { commons } from "@0xsequence/core"
import { isSignerStatusSigned, Orchestrator, Status } from "@0xsequence/signhub"
import { Deferrable, subDigestOf } from "@0xsequence/utils"
import { FeeQuote, Relayer } from "@0xsequence/relayer"
import { resolveArrayProperties } from "../utils"
import { walletContracts } from '@0xsequence/abi'
import { TransactionResponse } from "@ethersproject/providers"
import { Interface } from '@ethersproject/abi'
import { addressOf } from "@0xsequence/config"

/**
 * The OnChainWallet class fetches on-chain data from a wallet.
 * It is used to understand the "real" state of the wallet contract on-chain.
 */
 export class OnChainWallet {
  public readonly module: ethers.Contract

  constructor(
    public readonly address: string,
    public readonly provider: ethers.providers.Provider
  ) {
    this.module = new ethers.Contract(address, walletContracts.mainModuleUpgradable.abi, provider)
  }

  async isDeployed(): Promise<boolean> {
    const code = await this.provider.getCode(this.address).then((c) => ethers.utils.arrayify(c))
    return code.length !== 0
  }

  async implementation(): Promise<string | undefined> {
    const position = ethers.utils.defaultAbiCoder.encode(['address'], [this.address])
    const val = await this.provider.getStorageAt(this.address, position).then((c) => ethers.utils.arrayify(c))

    if (val.length === 20) {
      return ethers.utils.getAddress(ethers.utils.hexlify(val))
    }

    if (val.length === 32) {
      return ethers.utils.defaultAbiCoder.decode(['address'], val)[0]
    }

    return undefined
  }

  async imageHash(): Promise<string | undefined> {
    try {
      const imageHash = await this.module.imageHash()
      return imageHash
    } catch {}

    return undefined
  }

  async nonce(space: ethers.BigNumberish = 0): Promise<ethers.BigNumberish> {
    try {
      const nonce = await this.module.nonce(space)
      return nonce
    } catch (e) {
      if (!this.isDeployed()) {
        return 0
      }

      throw e
    }
  }
}


export type WalletOptions<
  T extends commons.signature.Signature<Y>,
  Y extends commons.config.Config,
  Z extends commons.signature.UnrecoveredSignature
> = {
  // Sequence version configurator
  coders: {
    config: commons.config.ConfigCoder<Y>,
    signature: commons.signature.SignatureCoder<T, Y, Z>
  }

  context: commons.context.WalletContext,
  config: Y,

  chainId: ethers.BigNumberish,
  address: string

  orchestrator: Orchestrator
  onChainWallet?: OnChainWallet
}

const statusToSignatureParts = (status: Status) => {
  const parts = new Map<string, commons.signature.SignaturePart>()

  for (const signer of Object.keys(status.signers)) {
    const value = status.signers[signer]
    if (isSignerStatusSigned(value)) {
      parts.set(signer, { signature: ethers.utils.hexlify(value.signature), isDynamic: !value.isEOA })
    }
  }

  return parts
}

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
  T extends commons.signature.Signature<Y>,
  Y extends commons.config.Config,
  Z extends commons.signature.UnrecoveredSignature
> extends ethers.Signer {
  public context: commons.context.WalletContext
  public config: Y
  public address: string
  public chainId: ethers.BigNumberish

  public provider?: ethers.providers.Provider
  public relayer?: Relayer

  public coders: {
    signature: commons.signature.SignatureCoder<T, Y, Z>
    config: commons.config.ConfigCoder<Y>
  }

  private orchestrator: Orchestrator
  private statusProvider?: OnChainWallet

  constructor(options: WalletOptions<T, Y, Z>) {
    super()
  
    this.context = options.context
    this.config = options.config
    this.orchestrator = options.orchestrator
    this.coders = options.coders
    this.address = options.address
    this.chainId = options.chainId
  }

  status(): OnChainWallet {
    if (this.statusProvider) return this.statusProvider
    if (!this.provider) throw new Error("Wallet status provider requires a provider")
    return new OnChainWallet(this.address, this.provider)
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

  async decorateTransactions(bundle: commons.transaction.IntendedTransactionBundle): Promise<commons.transaction.IntendedTransactionBundle> {
    if (await this.status().isDeployed()) return bundle

    const deployTx = this.buildDeployTransaction()

    return {
      entrypoint: deployTx.entrypoint,
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
    const factoryInterface = new Interface(walletContracts.factory.abi)

    const imageHash = this.coders.config.imageHashOf(this.config)
    const initialAddress = addressOf(imageHash, this.context)

    if (initialAddress !== this.address) {
      throw new Error(`Wallet not configured with initial configuration: ${initialAddress} !== ${this.address}`)
    }

    return {
      entrypoint: this.context.guestModule,
      transactions: [{
        to: this.context.factory,
        data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy'),
          [this.context.mainModule, imageHash]
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
      const implementation = await this.status().implementation()
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
    const signature = await this.orchestrator.signMessage(subdigest, (status: Status): boolean => {
      const parts = statusToSignatureParts(status)
      return this.coders.signature.hasEnoughSigningPower(this.config, parts)
    })

    const parts = statusToSignatureParts(signature)
    return this.coders.signature.encodeSigners(this.config, parts, [], this.chainId).encoded
  }

  async signMessage(message: ethers.BytesLike): Promise<string> {
    return this.signDigest(ethers.utils.keccak256(message))
  }

  async signTransactions(txs: Deferrable<commons.transaction.Transactionish>): Promise<commons.transaction.SignedTransactionBundle> {
    const transaction = await resolveArrayProperties<commons.transaction.Transactionish>(txs)

    let stx = commons.transaction.fromTransactionish(this.address, transaction)

    let nonce: ethers.BigNumberish | undefined = commons.transaction.readSequenceNonce(...stx)
    if (nonce === undefined) {
      nonce = await this.status().nonce()
      if (nonce === undefined) throw new Error("Unable to determine nonce")
      stx = commons.transaction.appendNonce(stx, nonce)
    }

    const digest = commons.transaction.digestOfTransactions(...stx)
    const signature = await this.signDigest(digest)

    return {
      intent: {
        digest,
        wallet: this.address
      },
      chainId: this.chainId,
      transactions: stx,
      entrypoint: this.address,
      nonce,
      signature
    }
  }

  async sendSignedTransaction(
    signedBundle: commons.transaction.SignedTransactionBundle,
    quote?: FeeQuote
  ): Promise<TransactionResponse> {
    if (!this.relayer) throw new Error("Wallet sendTransaction requires a relayer")
    return this.relayer.relay(signedBundle, quote)
  }

  async sendTransaction(
    txs: Deferrable<commons.transaction.Transactionish>,
    quote?: FeeQuote
  ): Promise<TransactionResponse> {
    const signed = await this.signTransactions(txs)
    return this.sendSignedTransaction(signed, quote)
  }

  connect(provider: ethers.providers.Provider, relayer?: Relayer): Wallet<T, Y, Z> {
    this.provider = provider
    this.relayer = relayer
    return this
  }

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    throw new Error("Method not implemented.");
  }
}

import { ethers } from "ethers"
import { commons } from "@0xsequence/core"
import { isSignerStatusSigned, Orchestrator, Status } from "@0xsequence/signhub"
import { subDigestOf } from "@0xsequence/utils"

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

  public coders: {
    signature: commons.signature.SignatureCoder<T, Y, Z>
    config: commons.config.ConfigCoder<Y>
  }

  private orchestrator: Orchestrator

  constructor(options: WalletOptions<T, Y, Z>) {
    super()
  
    this.context = options.context
    this.config = options.config
    this.orchestrator = options.orchestrator
    this.coders = options.coders
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

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    throw new Error("Method not implemented.");
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    throw new Error("Method not implemented.");
  }
}

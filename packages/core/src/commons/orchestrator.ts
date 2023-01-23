import { ethers } from "ethers"
import { commons } from ".."
import { Config } from "./config"

/**
 * Request metadata, used to by the wallet to pass additional information to the
 * orchestrator.
 */
export type WalletSignRequestMetadata = {
  address: string,
  digest: ethers.utils.BytesLike,
  chainId: ethers.BigNumberish,

  config: Config,

  signatureParts?: Map<string, commons.signature.SignaturePart>,

  // TODO: We can add a "percentage" field to the orchestrator to indicate
  //       how close are we to the threshold. This can be used to display
  //       a progress bar or something similar.

  message?: ethers.utils.BytesLike
  transactions?: commons.transaction.Transaction[]

  // This is used only when a Sequence wallet is nested in another Sequence wallet
  // it contains the original metadata of the parent wallet.
  parent?: WalletSignRequestMetadata
}

export function isWalletSignRequestMetadata(obj: any): obj is WalletSignRequestMetadata {
  return obj && obj.address && obj.digest && obj.chainId && obj.config
}

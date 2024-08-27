import { ethers } from 'ethers'
import { commons } from '..'
import { Config } from './config'

/**
 * Request metadata, used by the wallet to pass additional information through the orchestrator.
 */
export type WalletSignRequestMetadata = {
  address: string
  digest: ethers.BytesLike
  chainId: ethers.BigNumberish

  config: Config

  parts?: Map<string, commons.signature.SignaturePart>

  // TODO: We can add a "percentage" field to the orchestrator to indicate
  //       how close are we to the threshold. This can be used to display
  //       a progress bar or something similar.

  message?: ethers.BytesLike
  transactions?: commons.transaction.Transaction[]

  // This is used only when a Sequence wallet is nested in another Sequence wallet
  // it contains the original metadata of the parent wallet.
  parent?: WalletSignRequestMetadata

  decorate?: boolean
  cantValidateBehavior?: 'ignore' | 'eip6492' | 'throw'
}

export function isWalletSignRequestMetadata(obj: any): obj is WalletSignRequestMetadata {
  return obj && obj.address && obj.digest && obj.chainId !== undefined && obj.config
}

/**
 * Request metadata, used by the wallet to pass additional information through the orchestrator.
 */
export type WalletDeployMetadata = {
  includeChildren?: boolean // Whether to include children in deployment, default false
  ignoreDeployed?: boolean // Whether to ignore already deployed wallets, default false
}

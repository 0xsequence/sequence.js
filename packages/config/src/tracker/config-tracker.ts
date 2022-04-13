import { WalletContext } from '@0xsequence/network'
import { ethers } from 'ethers'
import { DecodedSignaturePart, WalletConfig } from '..'

export type TransactionBody = {
  wallet: string,
  tx: string,
  newImageHash: string,
  gapNonce: ethers.BigNumber,
  nonce: ethers.BigNumber,
  update?: string
}

export type PresignedConfigUpdate = {
  body: TransactionBody,
  signature: string,
  chainId: ethers.BigNumber
}

export type PresignedConfigurationPayload = {
  wallet: string,
  config: WalletConfig,
  tx: TransactionBody,
  signatures: {
    chainId: ethers.BigNumber,
    signature: string
  }[]
}

export type ConfigDataDump = {
  configurations: WalletConfig[],
  wallets: {
    imageHashe: string,
    context: WalletContext
  }[],
  presignedTransactions: PresignedConfigurationPayload[]
}

// AssumedWalletConfigs are configs that are assumed to be valid
// for a given sequence smart contract wallet, this is needed to validate
// guard signatures statically.
export type AssumedWalletConfigs = { [key: string]: WalletConfig }

export function asPresignedConfigurationAsPayload(
  presigned: PresignedConfigUpdate,
  config: WalletConfig
): PresignedConfigurationPayload {
  return {
    config,
    wallet: presigned.body.wallet,
    tx: presigned.body,
    signatures: [{
      chainId: presigned.chainId,
      signature: presigned.signature
    }]
  }
}

export abstract class ConfigTracker {
  loadPresignedConfiguration: (args: {
    wallet: string,
    fromImageHash: string,
    chainId: ethers.BigNumberish,
    prependUpdate: string[]
  }) => Promise<PresignedConfigUpdate[]>

  savePresignedConfiguration: (
    args: PresignedConfigurationPayload
  ) => Promise<void>

  saveWitness: ( args: {
    wallet: string,
    digest: string,
    signatures: {
      chainId: ethers.BigNumberish,
      signature: string
    }[],
  }) => Promise<void>

  configOfImageHash: (args: {
    imageHash: string
  }) => Promise<WalletConfig | undefined>

  saveWalletConfig: (args: {
    config: WalletConfig
  }) => Promise<void>

  imageHashOfCounterFactualWallet: (args: {
    context: WalletContext,
    wallet: string
  }) => Promise<string | undefined>

  saveCounterFactualWallet: (args: {
    imageHash: string,
    context: WalletContext
  }) => Promise<void>

  walletsOfSigner: (args: {
    signer: string
  }) => Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]>

  signaturesOfSigner: (args: {
    signer: string
  }) => Promise<{ signature: string, chainid: ethers.BigNumber, wallet: string, digest: string }[]>

  imageHashesOfSigner: (args: {
    signer: string
  }) => Promise<string[]>

  signaturesForImageHash: (args: {
    imageHash: string
  }) => Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]>
}

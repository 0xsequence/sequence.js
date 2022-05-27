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
    prependUpdate: string[],
    assumedConfigs?: AssumedWalletConfigs,
    longestPath?: boolean,
    gapNonce?: ethers.BigNumberish
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

export type ExporteConfigTrackerData = {
  version: number,
  contexts: WalletContext[],
  configs: WalletConfig[],
  wallets: {
    imageHash: string,
    context: number
  }[],
  transactions: {
    wallet: string,
    config: WalletConfig,
    tx: {
      wallet: string,
      tx: string,
      newImageHash: string,
      gapNonce: string,
      nonce: string,
      update?: string
    },
    signatures: {
      chainId: string,
      signature: string
    }[]
  }[],
  witnesses: {
    wallet: string,
    digest: string,
    signatures: {
      chainId: string,
      signature: string
    }[]
  }[]
}

export interface ExportableConfigTracker {
  isExportable: () => boolean

  export: () => Promise<ExporteConfigTrackerData>
  import: (data: ExporteConfigTrackerData) => Promise<void>
}

export function isExportableConfigTracker(
  tracker: ConfigTracker
): tracker is ConfigTracker & ExportableConfigTracker {
  return ((tracker as any).isExportable)?.() ?? false
}

export function isExportedConfigTrackerData(data: any): data is ExportableConfigTracker {
  if (!data.version || data.version !== 0) return false

  if (!data.contexts || !Array.isArray(data.contexts)) return false
  if (!data.configs || !Array.isArray(data.configs)) return false
  if (!data.wallets || !Array.isArray(data.wallets)) return false
  if (!data.transactions || !Array.isArray(data.transactions)) return false
  if (!data.witnesses || !Array.isArray(data.witnesses)) return false

  // TODO: Maybe add more validations?

  return true
}

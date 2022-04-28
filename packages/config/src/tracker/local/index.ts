import { WalletContext } from '@0xsequence/network'
import { ethers } from 'ethers'
import { DecodedSignaturePart, WalletConfig } from '../..'
import { TransactionBody } from '../config-tracker'

export type SignaturePart = {
  wallet: string,
  signer: string,
  digest: string,
  chainId: ethers.BigNumber,
  signature: DecodedSignaturePart,
  imageHash?: string
}

export interface ConfigTrackerDatabase {
  imageHashOfCounterFactualWallet: (args: {
    context: WalletContext,
    wallet: string
  }) => Promise<string | undefined>

  saveCounterFactualWallet: (args: {
    wallet: string,
    imageHash: string,
    context: WalletContext
  }) => Promise<void>

  configOfImageHash: (args: {
    imageHash: string
  }) => Promise<WalletConfig | undefined>

  imageHashesOfSigner: (args: {
    signer: string
  }) => Promise<string[]>

  saveWalletConfig: (args: {
    imageHash: string,
    config: WalletConfig
  }) => Promise<void>

  transactionWithDigest: (args: {
    digest: string
  }) => Promise<TransactionBody | undefined>

  savePresignedTransaction: (args: {
    digest: string,
    body: TransactionBody
  }) => Promise<void>

  saveSignatureParts: (args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumber,
    signatures: {
      part: DecodedSignaturePart,
      signer: string,
    }[],
    imageHash?: string
  }) => Promise<void>

  getSignaturePart: (args: {
    signer: string,
    digest: string,
    chainId: ethers.BigNumberish
  }) => Promise<SignaturePart | undefined>

  getSignaturePartsForAddress: (args: {
    signer: string,
    chainId?: ethers.BigNumberish
  }) => Promise<SignaturePart[]>

  getSignaturePartsForImageHash: (args: {
    imageHash: string,
  }) => Promise<SignaturePart[]>
}

export * from './local-config-tracker'
export * from './memory-config-tracker-db'
export * from './indexed-config-tracker-db'

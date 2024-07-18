import { ethers } from 'ethers'
import { WalletContext } from './context'
import * as transaction from './transaction'

export type Config = {
  version: number
}

export type SimpleSigner = { address: string; weight: ethers.BigNumberish }

export type SimpleConfig = {
  threshold: ethers.BigNumberish
  checkpoint: ethers.BigNumberish
  signers: SimpleSigner[]
  subdigests?: string[]
}

export interface ConfigCoder<T extends Config = Config> {
  imageHashOf: (config: T) => string
  hasSubdigest: (config: T, subdigest: string) => boolean

  isWalletConfig: (config: Config) => config is T

  checkpointOf: (config: T) => bigint

  fromSimple: (config: SimpleConfig) => T

  signersOf: (config: T) => { address: string; weight: number }[]

  toJSON: (config: T) => string
  fromJSON: (json: string) => T

  isComplete: (config: T) => boolean

  editConfig: (
    config: T,
    action: {
      add?: SimpleSigner[]
      remove?: string[]
      threshold?: ethers.BigNumberish
      checkpoint?: ethers.BigNumberish
    }
  ) => T

  buildStubSignature: (config: T, overrides: Map<string, string>) => string

  // isValid: (config: T) => boolean

  // TODO: This may not be the best place for this
  // maybe it could go in the migration classes?
  update: {
    isKindUsed: boolean

    buildTransaction: (
      address: string,
      config: T,
      context: WalletContext,
      kind?: 'first' | 'later' | undefined
    ) => transaction.TransactionBundle

    decodeTransaction: (tx: transaction.TransactionBundle) => {
      address: string
      newImageHash: string
      kind: 'first' | 'later' | undefined
    }
  }
}


import { ethers } from 'ethers'
import { WalletContext } from './context'
import * as transaction from './transaction'

export type Config = {
  version: number
}

export type SimpleConfig = {
  threshold: ethers.BigNumberish,
  checkpoint: ethers.BigNumberish,
  signers: { address: string, weight: ethers.BigNumberish }[]
}

export interface ConfigCoder<T extends Config = Config> {
  imageHashOf: (config: T) => string
  hasSubdigest: (config: T, subdigest: string) => boolean

  isWalletConfig: (config: Config) => config is T

  checkpointOf: (config: T) => ethers.BigNumber

  fromSimple: (config: SimpleConfig) => T

  signersOf: (config: T) => string[]

  toJSON: (config: T) => string
  fromJSON: (json: string) => T

  // isValid: (config: T) => boolean

  // TODO: This may not be the best place for this
  // maybe it could go in the migration classes?
  update: {
    isKindUsed: boolean,

    buildTransaction: (
      address: string,
      config: T,
      context: WalletContext,
      kind?: 'first' | 'later' | undefined
    ) => transaction.TransactionBundle

    decodeTransaction: (tx: transaction.TransactionBundle) => {
      address: string,
      newImageHash: string,
      kind: 'first' | 'later' | undefined
    }
  }
}

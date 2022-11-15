
import { WalletContext } from './context'
import * as transaction from './transaction'

export type Config = {
  version: number
}

export interface ConfigCoder<T extends Config> {
  imageHashOf: (config: T) => string
  hasSubdigest: (config: T, subdigest: string) => boolean

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
  }
}

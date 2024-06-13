import { WalletContext as BaseContext } from '../commons/context'

export type WalletContext = BaseContext & {
  version: 1
  multiCallUtils: string
}

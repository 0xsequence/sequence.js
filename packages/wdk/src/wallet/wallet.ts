import { Address } from 'ox'
import { WalletRow } from '../manager'

export type Transaction = {
  to: Address.Address
  value?: bigint
  data?: Uint8Array
}

export class Wallet {
  constructor(private readonly row: WalletRow) {}

  address(): string {
    return this.row.wallet
  }

  async sendTransaction(chainId: bigint, txs: Transaction[]): Promise<void> {}
}

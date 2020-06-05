import { ArcadeumTransaction, ArcadeumContext, ArcadeumWalletConfig } from '../types'
import { TransactionResponse } from 'ethers/providers'

export declare abstract class Relayer {
  constructor()
  abstract relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse>
}

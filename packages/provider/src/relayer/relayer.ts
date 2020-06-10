import { ArcadeumTransaction, ArcadeumContext, ArcadeumWalletConfig } from '../types'
import { TransactionResponse, BlockTag } from 'ethers/providers'

export declare abstract class Relayer {
  constructor()

  abstract getNonce(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    space?: number,
    blockTag?: BlockTag
  ): Promise<number>

  abstract relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse>
}

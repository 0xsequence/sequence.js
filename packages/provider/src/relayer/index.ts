import { ArcadeumTransaction, ArcadeumContext, ArcadeumWalletConfig } from '../types'
import { TransactionResponse, BlockTag } from 'ethers/providers'

export interface IRelayer {
  estimateGasLimits(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...transactions: ArcadeumTransaction[]
  ): Promise<ArcadeumTransaction[]>

  getNonce(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    space?: number,
    blockTag?: BlockTag
  ): Promise<number>

  relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse>
}

export { LocalRelayer } from './local-relayer'
export { RpcRelayer } from './rpc-relayer'

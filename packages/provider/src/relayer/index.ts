import { ArcadeumTransaction, ArcadeumContext, ArcadeumWalletConfig } from '../types'
import { providers } from 'ethers'

export interface IRelayer {
  estimateGasLimits(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...transactions: ArcadeumTransaction[]
  ): Promise<ArcadeumTransaction[]>

  gasRefundOptions(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...transactions: ArcadeumTransaction[]
  ): Promise<ArcadeumTransaction[][]>

  getNonce(config: ArcadeumWalletConfig, context: ArcadeumContext, space?: number, blockTag?: providers.BlockTag): Promise<number>

  relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<providers.TransactionResponse>
}

export { LocalRelayer } from './local-relayer'
export { RpcRelayer } from './rpc-relayer'

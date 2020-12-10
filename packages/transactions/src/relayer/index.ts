import { providers } from 'ethers'
import { SequenceTransaction,  } from '../types'
import { WalletContext } from '@0xsequence/networks'
import { WalletConfig } from '@0xsequence/auth'

// TODO: drop the "I"
export interface IRelayer {
  estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: SequenceTransaction[]
  ): Promise<SequenceTransaction[]>

  gasRefundOptions(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: SequenceTransaction[]
  ): Promise<SequenceTransaction[][]>

  getNonce(config: WalletConfig, context: WalletContext, space?: number, blockTag?: providers.BlockTag): Promise<number>

  relay(
    config: WalletConfig,
    context: WalletContext,
    signature: string | Promise<string>,
    ...transactions: SequenceTransaction[]
  ): Promise<providers.TransactionResponse>
}

export { LocalRelayer } from './local-relayer'
export { RpcRelayer } from './rpc-relayer'

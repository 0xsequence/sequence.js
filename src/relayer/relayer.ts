import { Address, Hex } from 'ox'
import { FeeToken } from './rpc-relayer/relayer.gen.js'
import { FeeOption, FeeQuote, OperationStatus } from './index.js'
import { Payload, Precondition } from '@0xsequence/wallet-primitives'

export interface Relayer {
  kind: 'relayer'

  type: string
  id: string

  isAvailable(wallet: Address.Address, chainId: number): Promise<boolean>

  feeTokens(): Promise<{ isFeeRequired: boolean; tokens?: FeeToken[]; paymentAddress?: Address.Address }>

  feeOptions(
    wallet: Address.Address,
    chainId: number,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  relay(to: Address.Address, data: Hex.Hex, chainId: number, quote?: FeeQuote): Promise<{ opHash: Hex.Hex }>

  status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>

  checkPrecondition(precondition: Precondition.Precondition): Promise<boolean>
}

export function isRelayer(relayer: any): relayer is Relayer {
  return (
    'isAvailable' in relayer &&
    'feeOptions' in relayer &&
    'relay' in relayer &&
    'status' in relayer &&
    'checkPrecondition' in relayer
  )
}

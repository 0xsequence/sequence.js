import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { UserOperation } from 'ox/erc4337'
import { OperationStatus } from './relayer.js'

export interface Bundler {
  kind: 'bundler'

  id: string

  estimateLimits(
    wallet: Address.Address,
    payload: Payload.Calls4337_07,
  ): Promise<{ speed?: 'slow' | 'standard' | 'fast'; payload: Payload.Calls4337_07 }[]>
  relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{ opHash: Hex.Hex }>
  status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>

  isAvailable(entrypoint: Address.Address, chainId: number): Promise<boolean>
}

export function isBundler(relayer: any): relayer is Bundler {
  return 'estimateLimits' in relayer && 'relay' in relayer && 'isAvailable' in relayer
}

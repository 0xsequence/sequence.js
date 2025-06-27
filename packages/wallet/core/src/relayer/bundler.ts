import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { UserOperation } from 'ox/erc4337'

export interface Bundler {
  kind: 'bundler'

  id: string

  estimateLimits(wallet: Address.Address, payload: Payload.Calls4337_07): Promise<Payload.Calls4337_07>
  relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{ opHash: Hex.Hex }>

  isAvailable(entrypoint: Address.Address, chainId: bigint): Promise<boolean>
}

export function isBundler(relayer: any): relayer is Bundler {
  return 'estimateLimits' in relayer && 'relay' in relayer && 'isAvailable' in relayer
}

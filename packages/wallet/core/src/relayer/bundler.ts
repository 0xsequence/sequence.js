import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export interface Bundler {
  id: 'bundler'

  estimateLimits(payload: Payload.Calls4337_07): Promise<Payload.Calls4337_07>
  relay(payload: Payload.Calls4337_07): Promise<{ opHash: Hex.Hex }>

  isAvailable(wallet: Address.Address, chainId: bigint): Promise<boolean>
}

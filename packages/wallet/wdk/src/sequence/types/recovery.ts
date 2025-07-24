import { Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'

export type QueuedRecoveryPayload = {
  id: string
  index: bigint
  recoveryModule: Address.Address
  wallet: Address.Address
  signer: Address.Address
  chainId: bigint
  startTimestamp: bigint
  endTimestamp: bigint
  payloadHash: Hex.Hex
  payload?: Payload.Payload
}

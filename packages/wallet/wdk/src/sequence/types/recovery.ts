import { Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'

export type QueuedRecoveryPayload = {
  id: string
  index: bigint
  recoveryModule: Address.Checksummed
  wallet: Address.Checksummed
  signer: Address.Checksummed
  chainId: bigint
  startTimestamp: bigint
  endTimestamp: bigint
  payloadHash: Hex.Hex
  payload?: Payload.Payload
}

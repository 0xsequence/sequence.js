import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

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
  // TODO: we can get the payload but we need
  // to listen to events, for now we will just
  // include the hash only, until we have the
  // indexer
  // payload: Payload.Recovery<Payload.Calls>
}

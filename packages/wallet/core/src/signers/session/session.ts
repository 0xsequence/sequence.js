import { Address, Provider } from 'ox'
import { Payload, SessionSignature } from '@0xsequence/wallet-primitives'

export interface SignerInterface {
  /// Check if the signer supports the call
  supportedCall: (
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    provider?: Provider.Provider,
  ) => Promise<boolean>
  /// Sign the call. Will throw if the call is not supported.
  signCall: (
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    nonce: {
      space: bigint
      nonce: bigint
    },
    provider?: Provider.Provider,
  ) => Promise<SessionSignature.SessionCallSignature>
}

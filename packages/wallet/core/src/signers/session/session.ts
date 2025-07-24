import { Payload, SessionSignature } from '@0xsequence/wallet-primitives'
import { Hex, Provider } from 'ox'

export interface SessionSigner {
  address: Address.Checksummed | Promise<Address.Checksummed>

  /// Check if the signer supports the call
  supportedCall: (
    wallet: Address.Checksummed,
    chainId: bigint,
    call: Payload.Call,
    sessionManagerAddress: Address.Checksummed,
    provider?: Provider.Provider,
  ) => Promise<boolean>

  /// Sign the call. Will throw if the call is not supported.
  signCall: (
    wallet: Address.Checksummed,
    chainId: bigint,
    call: Payload.Call,
    nonce: {
      space: bigint
      nonce: bigint
    },
    sessionManagerAddress: Address.Checksummed,
    provider?: Provider.Provider,
  ) => Promise<SessionSignature.SessionCallSignature>
}

export type UsageLimit = {
  usageHash: Hex.Hex
  usageAmount: bigint
}

export interface ExplicitSessionSigner extends SessionSigner {
  prepareIncrements: (
    wallet: Address.Checksummed,
    chainId: bigint,
    calls: Payload.Call[],
    sessionManagerAddress: Address.Checksummed,
    provider: Provider.Provider,
  ) => Promise<UsageLimit[]>
}

export function isExplicitSessionSigner(signer: SessionSigner): signer is ExplicitSessionSigner {
  return 'prepareIncrements' in signer
}

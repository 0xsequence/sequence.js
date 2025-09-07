import { Payload, SessionSignature } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider } from 'ox'

export interface SessionSigner {
  address: Address.Address | Promise<Address.Address>

  /// Check if the signer supports the call
  supportedCall: (
    wallet: Address.Address,
    chainId: number,
    call: Payload.Call,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ) => Promise<boolean>

  /// Sign the call. Will throw if the call is not supported.
  signCall: (
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Calls,
    callIdx: number,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ) => Promise<SessionSignature.SessionCallSignature>
}

export type UsageLimit = {
  usageHash: Hex.Hex
  usageAmount: bigint
}

export interface ExplicitSessionSigner extends SessionSigner {
  prepareIncrements: (
    wallet: Address.Address,
    chainId: number,
    calls: Payload.Call[],
    sessionManagerAddress: Address.Address,
    provider: Provider.Provider,
  ) => Promise<UsageLimit[]>
}

export function isExplicitSessionSigner(signer: SessionSigner): signer is ExplicitSessionSigner {
  return 'prepareIncrements' in signer
}

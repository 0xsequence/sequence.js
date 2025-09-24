import { Payload, SessionConfig, SessionSignature } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider } from 'ox'

export type SessionSignerInvalidReason =
  | 'Expired'
  | 'Chain ID mismatch'
  | 'Permission not found'
  | 'Permission mismatch'
  | 'Permission rule mismatch'
  | 'Identity signer not found'
  | 'Blacklisted'

export type SessionSignerValidity = {
  isValid: boolean
  invalidReason?: SessionSignerInvalidReason
}

export interface SessionSigner {
  address: Address.Address | Promise<Address.Address>

  /// Check if the signer is valid for the given topology and chainId
  isValid: (sessionTopology: SessionConfig.SessionsTopology, chainId: number) => SessionSignerValidity

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

export interface ImplicitSessionSigner extends SessionSigner {
  identitySigner: Address.Address
}

export function isExplicitSessionSigner(signer: SessionSigner): signer is ExplicitSessionSigner {
  return 'prepareIncrements' in signer
}

export function isImplicitSessionSigner(signer: SessionSigner): signer is ImplicitSessionSigner {
  return 'identitySigner' in signer
}

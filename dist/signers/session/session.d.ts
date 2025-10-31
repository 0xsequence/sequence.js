import { Payload, SessionConfig, SessionSignature } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
export type SessionSignerInvalidReason = 'Expired' | 'Chain ID mismatch' | 'Permission not found' | 'Permission mismatch' | 'Permission rule mismatch' | 'Identity signer not found' | 'Identity signer mismatch' | 'Blacklisted';
export type SessionSignerValidity = {
    isValid: boolean;
    invalidReason?: SessionSignerInvalidReason;
};
export interface SessionSigner {
    address: Address.Address | Promise<Address.Address>;
    isValid: (sessionTopology: SessionConfig.SessionsTopology, chainId: number) => SessionSignerValidity;
    supportedCall: (wallet: Address.Address, chainId: number, call: Payload.Call, sessionManagerAddress: Address.Address, provider?: Provider.Provider) => Promise<boolean>;
    signCall: (wallet: Address.Address, chainId: number, payload: Payload.Calls, callIdx: number, sessionManagerAddress: Address.Address, provider?: Provider.Provider) => Promise<SessionSignature.SessionCallSignature>;
}
export type UsageLimit = {
    usageHash: Hex.Hex;
    usageAmount: bigint;
};
export interface ExplicitSessionSigner extends SessionSigner {
    prepareIncrements: (wallet: Address.Address, chainId: number, calls: Payload.Call[], sessionManagerAddress: Address.Address, provider: Provider.Provider) => Promise<UsageLimit[]>;
}
export interface ImplicitSessionSigner extends SessionSigner {
    identitySigner: Address.Address;
}
export declare function isExplicitSessionSigner(signer: SessionSigner): signer is ExplicitSessionSigner;
export declare function isImplicitSessionSigner(signer: SessionSigner): signer is ImplicitSessionSigner;
//# sourceMappingURL=session.d.ts.map
import { Signers as CoreSigners } from '@0xsequence/wallet-core';
import { Attestation, Signature as SequenceSignature, SessionConfig } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Shared } from './manager.js';
export type AuthorizeImplicitSessionArgs = {
    target: string;
    applicationData?: Hex.Hex;
};
export declare class Sessions {
    private readonly shared;
    constructor(shared: Shared);
    getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology>;
    prepareAuthorizeImplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, args: AuthorizeImplicitSessionArgs): Promise<string>;
    completeAuthorizeImplicitSession(requestId: string): Promise<{
        attestation: Attestation.Attestation;
        signature: SequenceSignature.RSY;
    }>;
    addExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, permissions: CoreSigners.Session.ExplicitParams, origin?: string): Promise<string>;
    removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, origin?: string): Promise<string>;
    addBlacklistAddress(walletAddress: Address.Address, address: Address.Address, origin?: string): Promise<string>;
    removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address, origin?: string): Promise<string>;
    private prepareSessionUpdate;
    completeSessionUpdate(requestId: string): Promise<void>;
}
//# sourceMappingURL=sessions.d.ts.map
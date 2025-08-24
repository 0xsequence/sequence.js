import { Attestation, Payload, Signature as SequenceSignature, SessionSignature } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import { PkStore } from '../pk/index.js';
import { SessionSigner } from './session.js';
export type AttestationParams = Omit<Attestation.Attestation, 'approvedSigner'>;
export declare class Implicit implements SessionSigner {
    private readonly _attestation;
    private readonly _sessionManager;
    private readonly _privateKey;
    private readonly _identitySignature;
    readonly address: Address.Address;
    constructor(privateKey: Hex.Hex | PkStore, _attestation: Attestation.Attestation, identitySignature: SequenceSignature.RSY | Hex.Hex, _sessionManager: Address.Address);
    get identitySigner(): Address.Address;
    supportedCall(wallet: Address.Address, _chainId: number, call: Payload.Call, _sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<boolean>;
    signCall(wallet: Address.Address, chainId: number, call: Payload.Call, nonce: {
        space: bigint;
        nonce: bigint;
    }, sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<SessionSignature.SessionCallSignature>;
}
//# sourceMappingURL=implicit.d.ts.map
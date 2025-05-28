import { Payload, SessionSignature } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
export interface SessionSigner {
    address: Address.Address | Promise<Address.Address>;
    supportedCall: (wallet: Address.Address, chainId: bigint, call: Payload.Call, sessionManagerAddress: Address.Address, provider?: Provider.Provider) => Promise<boolean>;
    signCall: (wallet: Address.Address, chainId: bigint, call: Payload.Call, nonce: {
        space: bigint;
        nonce: bigint;
    }, sessionManagerAddress: Address.Address, provider?: Provider.Provider) => Promise<SessionSignature.SessionCallSignature>;
}
export type UsageLimit = {
    usageHash: Hex.Hex;
    usageAmount: bigint;
};
export interface ExplicitSessionSigner extends SessionSigner {
    prepareIncrements: (wallet: Address.Address, chainId: bigint, calls: Payload.Call[], sessionManagerAddress: Address.Address, provider: Provider.Provider) => Promise<UsageLimit[]>;
}
export declare function isExplicitSessionSigner(signer: SessionSigner): signer is ExplicitSessionSigner;
//# sourceMappingURL=session.d.ts.map
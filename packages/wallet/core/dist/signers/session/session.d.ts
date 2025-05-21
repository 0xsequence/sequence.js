import { Address, Provider } from 'ox';
import { Payload, SessionSignature } from '@0xsequence/wallet-primitives';
export interface SessionSigner {
    address: Address.Address | Promise<Address.Address>;
    supportedCall: (wallet: Address.Address, chainId: bigint, call: Payload.Call, provider?: Provider.Provider) => Promise<boolean>;
    signCall: (wallet: Address.Address, chainId: bigint, call: Payload.Call, nonce: {
        space: bigint;
        nonce: bigint;
    }, provider?: Provider.Provider) => Promise<SessionSignature.SessionCallSignature>;
}
//# sourceMappingURL=session.d.ts.map
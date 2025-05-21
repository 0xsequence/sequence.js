import { Payload, Permission, SessionSignature } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import { SessionSigner } from './session.js';
import { PkStore } from '../pk/index.js';
export type ExplicitParams = Omit<Permission.SessionPermissions, 'signer'>;
export declare class Explicit implements SessionSigner {
    private readonly _privateKey;
    readonly address: Address.Address;
    readonly sessionPermissions: Permission.SessionPermissions;
    constructor(privateKey: Hex.Hex | PkStore, sessionPermissions: ExplicitParams);
    findSupportedPermission(wallet: Address.Address, _chainId: bigint, call: Payload.Call, provider?: Provider.Provider): Promise<Permission.Permission | undefined>;
    supportedCall(wallet: Address.Address, chainId: bigint, call: Payload.Call, provider?: Provider.Provider): Promise<boolean>;
    signCall(wallet: Address.Address, chainId: bigint, call: Payload.Call, nonce: {
        space: bigint;
        nonce: bigint;
    }, provider?: Provider.Provider): Promise<SessionSignature.SessionCallSignature>;
}
//# sourceMappingURL=explicit.d.ts.map
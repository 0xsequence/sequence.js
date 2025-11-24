import { Payload, Permission, SessionConfig, SessionSignature } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import { PkStore } from '../pk/index.js';
import { ExplicitSessionSigner, SessionSignerValidity, UsageLimit } from './session.js';
export type ExplicitParams = Omit<Permission.SessionPermissions, 'signer'>;
export declare class Explicit implements ExplicitSessionSigner {
    private readonly _privateKey;
    readonly address: Address.Address;
    readonly sessionPermissions: Permission.SessionPermissions;
    constructor(privateKey: Hex.Hex | PkStore, sessionPermissions: ExplicitParams);
    isValid(sessionTopology: SessionConfig.SessionsTopology, chainId: number): SessionSignerValidity;
    findSupportedPermission(wallet: Address.Address, chainId: number, call: Payload.Call, sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<Permission.Permission | undefined>;
    private getPermissionUsageHash;
    private getValueUsageHash;
    validatePermission(permission: Permission.Permission, call: Payload.Call, wallet: Address.Address, sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<boolean>;
    supportedCall(wallet: Address.Address, chainId: number, call: Payload.Call, sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<boolean>;
    signCall(wallet: Address.Address, chainId: number, payload: Payload.Calls, callIdx: number, sessionManagerAddress: Address.Address, provider?: Provider.Provider): Promise<SessionSignature.SessionCallSignature>;
    private readCurrentUsageLimit;
    prepareIncrements(wallet: Address.Address, chainId: number, calls: Payload.Call[], sessionManagerAddress: Address.Address, provider: Provider.Provider): Promise<UsageLimit[]>;
}
//# sourceMappingURL=explicit.d.ts.map
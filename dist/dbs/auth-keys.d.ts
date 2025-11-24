import { Generic } from './generic.js';
export type AuthKey = {
    address: string;
    privateKey: CryptoKey;
    identitySigner: string;
    expiresAt: Date;
};
export declare class AuthKeys extends Generic<AuthKey, 'address'> {
    private expirationTimers;
    constructor(dbName?: string);
    handleOpenDB(): Promise<void>;
    set(item: AuthKey): Promise<AuthKey['address']>;
    del(address: AuthKey['address']): Promise<void>;
    getBySigner(signer: string, attempt?: number): Promise<AuthKey | undefined>;
    delBySigner(signer: string): Promise<void>;
    private scheduleExpiration;
    private clearExpiration;
}
//# sourceMappingURL=auth-keys.d.ts.map
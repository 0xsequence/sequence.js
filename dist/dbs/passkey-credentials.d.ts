import { Generic } from './generic.js';
import { Address } from 'ox';
import { Extensions } from '@0xsequence/wallet-primitives';
export type PasskeyCredential = {
    credentialId: string;
    publicKey: Extensions.Passkeys.PublicKey;
    walletAddress: Address.Address;
    createdAt: string;
    lastLoginAt?: string;
};
export declare class PasskeyCredentials extends Generic<PasskeyCredential, 'credentialId'> {
    constructor(dbName?: string);
    /**
     * Get a passkey credential by credential ID
     */
    getByCredentialId(credentialId: string): Promise<PasskeyCredential | undefined>;
    /**
     * Store a new passkey credential
     */
    saveCredential(credentialId: string, publicKey: Extensions.Passkeys.PublicKey, walletAddress: Address.Address): Promise<void>;
    updateCredential(credentialId: string, { lastLoginAt, walletAddress }: {
        lastLoginAt: string;
        walletAddress: Address.Address;
    }): Promise<void>;
}
//# sourceMappingURL=passkey-credentials.d.ts.map
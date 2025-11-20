import { Generic } from './generic.js';
const TABLE_NAME = 'passkey-credentials';
export class PasskeyCredentials extends Generic {
    constructor(dbName = 'sequence-passkey-credentials') {
        super(dbName, TABLE_NAME, 'credentialId', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
    /**
     * Get a passkey credential by credential ID
     */
    async getByCredentialId(credentialId) {
        return this.get(credentialId);
    }
    /**
     * Store a new passkey credential
     */
    async saveCredential(credentialId, publicKey, walletAddress) {
        const now = new Date().toISOString();
        const credential = {
            credentialId,
            publicKey,
            walletAddress,
            createdAt: now,
            lastLoginAt: now, // Set initially on creation
        };
        await this.set(credential);
    }
    async updateCredential(credentialId, { lastLoginAt, walletAddress }) {
        const existingCredential = await this.getByCredentialId(credentialId);
        if (existingCredential) {
            const updatedCredential = { ...existingCredential, lastLoginAt, walletAddress };
            await this.set(updatedCredential);
        }
    }
}

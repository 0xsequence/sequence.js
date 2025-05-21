import { Generic } from './generic.js';
const TABLE_NAME = 'auth-keys';
export class AuthKeys extends Generic {
    expirationTimers = new Map();
    constructor(dbName = 'sequence-auth-keys') {
        super(dbName, TABLE_NAME, 'address', [
            (db) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    const store = db.createObjectStore(TABLE_NAME);
                    store.createIndex('identitySigner', 'identitySigner', { unique: true });
                }
            },
        ]);
    }
    async handleOpenDB() {
        const authKeys = await this.list();
        for (const authKey of authKeys) {
            this.scheduleExpiration(authKey);
        }
    }
    async set(item) {
        const result = await super.set(item);
        this.scheduleExpiration(item);
        return result;
    }
    async del(address) {
        const result = await super.del(address);
        this.clearExpiration(address);
        return result;
    }
    async getBySigner(signer) {
        const store = await this.getStore('readonly');
        const index = store.index('identitySigner');
        return new Promise((resolve, reject) => {
            const req = index.get(signer);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async delBySigner(signer) {
        const authKey = await this.getBySigner(signer);
        if (authKey) {
            await this.del(authKey.address);
        }
    }
    async scheduleExpiration(authKey) {
        this.clearExpiration(authKey.address);
        const now = Date.now();
        const delay = authKey.expiresAt.getTime() - now;
        if (delay <= 0) {
            await this.del(authKey.address);
            return;
        }
        const timer = window.setTimeout(() => {
            console.log('removing expired auth key', authKey);
            this.del(authKey.address);
        }, delay);
        this.expirationTimers.set(authKey.address, timer);
    }
    clearExpiration(address) {
        const timer = this.expirationTimers.get(address);
        if (timer) {
            window.clearTimeout(timer);
            this.expirationTimers.delete(address);
        }
    }
}

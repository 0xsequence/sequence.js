import { Hex, Address, Secp256k1 } from 'ox';
export class EncryptedPksDb {
    localStorageKeyPrefix;
    tableName;
    dbName = 'pk-db';
    dbVersion = 1;
    constructor(localStorageKeyPrefix = 'e_pk_key_', tableName = 'e_pk') {
        this.localStorageKeyPrefix = localStorageKeyPrefix;
        this.tableName = tableName;
    }
    computeDbKey(address) {
        return `pk_${address.toLowerCase()}`;
    }
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.tableName)) {
                    db.createObjectStore(this.tableName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async putData(key, value) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.tableName, 'readwrite');
            const store = tx.objectStore(this.tableName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getData(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.tableName, 'readonly');
            const store = tx.objectStore(this.tableName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async getAllData() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.tableName, 'readonly');
            const store = tx.objectStore(this.tableName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async generateAndStore() {
        const encryptionKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
            'encrypt',
            'decrypt',
        ]);
        const privateKey = Hex.random(32);
        const publicKey = Secp256k1.getPublicKey({ privateKey });
        const address = Address.fromPublicKey(publicKey);
        const keyPointer = this.localStorageKeyPrefix + address;
        const exportedKey = await window.crypto.subtle.exportKey('jwk', encryptionKey);
        window.localStorage.setItem(keyPointer, JSON.stringify(exportedKey));
        const encoder = new TextEncoder();
        const encodedPk = encoder.encode(privateKey);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, encodedPk);
        const encrypted = {
            iv,
            data: encryptedBuffer,
            keyPointer,
            address,
            publicKey,
        };
        const dbKey = this.computeDbKey(address);
        await this.putData(dbKey, encrypted);
        return encrypted;
    }
    async getEncryptedEntry(address) {
        const dbKey = this.computeDbKey(address);
        return this.getData(dbKey);
    }
    async getEncryptedPkStore(address) {
        const entry = await this.getEncryptedEntry(address);
        if (!entry)
            return;
        return new EncryptedPkStore(entry);
    }
    async listAddresses() {
        const allEntries = await this.getAllData();
        return allEntries.map((entry) => entry.address);
    }
    async remove(address) {
        const dbKey = this.computeDbKey(address);
        await this.putData(dbKey, undefined);
        const keyPointer = this.localStorageKeyPrefix + address;
        window.localStorage.removeItem(keyPointer);
    }
}
export class EncryptedPkStore {
    encrypted;
    constructor(encrypted) {
        this.encrypted = encrypted;
    }
    address() {
        return this.encrypted.address;
    }
    publicKey() {
        return this.encrypted.publicKey;
    }
    async signDigest(digest) {
        const keyJson = window.localStorage.getItem(this.encrypted.keyPointer);
        if (!keyJson)
            throw new Error('Encryption key not found in localStorage');
        const jwk = JSON.parse(keyJson);
        const encryptionKey = await window.crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['decrypt']);
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.encrypted.iv }, encryptionKey, this.encrypted.data);
        const decoder = new TextDecoder();
        const privateKey = decoder.decode(decryptedBuffer);
        return Secp256k1.sign({ payload: digest, privateKey });
    }
}

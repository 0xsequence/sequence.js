const DB_VERSION = 1;
const STORE_CONFIGS = 'configs';
const STORE_WALLETS = 'counterfactualWallets';
const STORE_PAYLOADS = 'payloads';
const STORE_SIGNER_SUBDIGESTS = 'signerSubdigests';
const STORE_SIGNATURES = 'signatures';
const STORE_SAPIENT_SIGNER_SUBDIGESTS = 'sapientSignerSubdigests';
const STORE_SAPIENT_SIGNATURES = 'sapientSignatures';
const STORE_TREES = 'trees';
export class IndexedDbStore {
    _db = null;
    dbName;
    constructor(dbName = 'sequence-indexeddb') {
        this.dbName = dbName;
    }
    async openDB() {
        if (this._db)
            return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_CONFIGS)) {
                    db.createObjectStore(STORE_CONFIGS);
                }
                if (!db.objectStoreNames.contains(STORE_WALLETS)) {
                    db.createObjectStore(STORE_WALLETS);
                }
                if (!db.objectStoreNames.contains(STORE_PAYLOADS)) {
                    db.createObjectStore(STORE_PAYLOADS);
                }
                if (!db.objectStoreNames.contains(STORE_SIGNER_SUBDIGESTS)) {
                    db.createObjectStore(STORE_SIGNER_SUBDIGESTS);
                }
                if (!db.objectStoreNames.contains(STORE_SIGNATURES)) {
                    db.createObjectStore(STORE_SIGNATURES);
                }
                if (!db.objectStoreNames.contains(STORE_SAPIENT_SIGNER_SUBDIGESTS)) {
                    db.createObjectStore(STORE_SAPIENT_SIGNER_SUBDIGESTS);
                }
                if (!db.objectStoreNames.contains(STORE_SAPIENT_SIGNATURES)) {
                    db.createObjectStore(STORE_SAPIENT_SIGNATURES);
                }
                if (!db.objectStoreNames.contains(STORE_TREES)) {
                    db.createObjectStore(STORE_TREES);
                }
            };
            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    async get(storeName, key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async put(storeName, key, value) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    async getSet(storeName, key) {
        const data = (await this.get(storeName, key)) || new Set();
        return Array.isArray(data) ? new Set(data) : data;
    }
    async putSet(storeName, key, setData) {
        await this.put(storeName, key, Array.from(setData));
    }
    getSignatureKey(signer, subdigest) {
        return `${signer.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    getSapientSignatureKey(signer, subdigest, imageHash) {
        return `${signer.toLowerCase()}-${imageHash.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    async loadConfig(imageHash) {
        return this.get(STORE_CONFIGS, imageHash.toLowerCase());
    }
    async saveConfig(imageHash, config) {
        await this.put(STORE_CONFIGS, imageHash.toLowerCase(), config);
    }
    async loadCounterfactualWallet(wallet) {
        return this.get(STORE_WALLETS, wallet.toLowerCase());
    }
    async saveCounterfactualWallet(wallet, imageHash, context) {
        await this.put(STORE_WALLETS, wallet.toLowerCase(), { imageHash, context });
    }
    async loadPayloadOfSubdigest(subdigest) {
        return this.get(STORE_PAYLOADS, subdigest.toLowerCase());
    }
    async savePayloadOfSubdigest(subdigest, payload) {
        await this.put(STORE_PAYLOADS, subdigest.toLowerCase(), payload);
    }
    async loadSubdigestsOfSigner(signer) {
        const dataSet = await this.getSet(STORE_SIGNER_SUBDIGESTS, signer.toLowerCase());
        return Array.from(dataSet);
    }
    async loadSignatureOfSubdigest(signer, subdigest) {
        const key = this.getSignatureKey(signer, subdigest);
        return this.get(STORE_SIGNATURES, key.toLowerCase());
    }
    async saveSignatureOfSubdigest(signer, subdigest, signature) {
        const key = this.getSignatureKey(signer, subdigest);
        await this.put(STORE_SIGNATURES, key.toLowerCase(), signature);
        const signerKey = signer.toLowerCase();
        const subdigestKey = subdigest.toLowerCase();
        const dataSet = await this.getSet(STORE_SIGNER_SUBDIGESTS, signerKey);
        dataSet.add(subdigestKey);
        await this.putSet(STORE_SIGNER_SUBDIGESTS, signerKey, dataSet);
    }
    async loadSubdigestsOfSapientSigner(signer, imageHash) {
        const key = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`;
        const dataSet = await this.getSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, key);
        return Array.from(dataSet);
    }
    async loadSapientSignatureOfSubdigest(signer, subdigest, imageHash) {
        const key = this.getSapientSignatureKey(signer, subdigest, imageHash);
        return this.get(STORE_SAPIENT_SIGNATURES, key.toLowerCase());
    }
    async saveSapientSignatureOfSubdigest(signer, subdigest, imageHash, signature) {
        const fullKey = this.getSapientSignatureKey(signer, subdigest, imageHash).toLowerCase();
        await this.put(STORE_SAPIENT_SIGNATURES, fullKey, signature);
        const signerKey = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`;
        const subdigestKey = subdigest.toLowerCase();
        const dataSet = await this.getSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, signerKey);
        dataSet.add(subdigestKey);
        await this.putSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, signerKey, dataSet);
    }
    async loadTree(rootHash) {
        return this.get(STORE_TREES, rootHash.toLowerCase());
    }
    async saveTree(rootHash, tree) {
        await this.put(STORE_TREES, rootHash.toLowerCase(), tree);
    }
}

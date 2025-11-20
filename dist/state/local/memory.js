export class MemoryStore {
    configs = new Map();
    counterfactualWallets = new Map();
    payloads = new Map();
    signerSubdigests = new Map();
    signatures = new Map();
    sapientSignerSubdigests = new Map();
    sapientSignatures = new Map();
    trees = new Map();
    deepCopy(value) {
        // modern runtime → fast native path
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        // very small poly-fill for old environments
        if (value === null || typeof value !== 'object')
            return value;
        if (value instanceof Date)
            return new Date(value.getTime());
        if (Array.isArray(value))
            return value.map((v) => this.deepCopy(v));
        if (value instanceof Map) {
            return new Map(Array.from(value, ([k, v]) => [this.deepCopy(k), this.deepCopy(v)]));
        }
        if (value instanceof Set) {
            return new Set(Array.from(value, (v) => this.deepCopy(v)));
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = this.deepCopy(v);
        }
        return out;
    }
    getSignatureKey(signer, subdigest) {
        return `${signer.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    getSapientSignatureKey(signer, subdigest, imageHash) {
        return `${signer.toLowerCase()}-${imageHash.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    async loadConfig(imageHash) {
        const config = this.configs.get(imageHash.toLowerCase());
        return config ? this.deepCopy(config) : undefined;
    }
    async saveConfig(imageHash, config) {
        this.configs.set(imageHash.toLowerCase(), this.deepCopy(config));
    }
    async loadCounterfactualWallet(wallet) {
        const counterfactualWallet = this.counterfactualWallets.get(wallet.toLowerCase());
        return counterfactualWallet ? this.deepCopy(counterfactualWallet) : undefined;
    }
    async saveCounterfactualWallet(wallet, imageHash, context) {
        this.counterfactualWallets.set(wallet.toLowerCase(), this.deepCopy({ imageHash, context }));
    }
    async loadPayloadOfSubdigest(subdigest) {
        const payload = this.payloads.get(subdigest.toLowerCase());
        return payload ? this.deepCopy(payload) : undefined;
    }
    async savePayloadOfSubdigest(subdigest, payload) {
        this.payloads.set(subdigest.toLowerCase(), this.deepCopy(payload));
    }
    async loadSubdigestsOfSigner(signer) {
        const subdigests = this.signerSubdigests.get(signer.toLowerCase());
        return subdigests ? Array.from(subdigests).map((s) => s) : [];
    }
    async loadSignatureOfSubdigest(signer, subdigest) {
        const key = this.getSignatureKey(signer, subdigest);
        const signature = this.signatures.get(key);
        return signature ? this.deepCopy(signature) : undefined;
    }
    async saveSignatureOfSubdigest(signer, subdigest, signature) {
        const key = this.getSignatureKey(signer, subdigest);
        this.signatures.set(key, this.deepCopy(signature));
        const signerKey = signer.toLowerCase();
        const subdigestKey = subdigest.toLowerCase();
        if (!this.signerSubdigests.has(signerKey)) {
            this.signerSubdigests.set(signerKey, new Set());
        }
        this.signerSubdigests.get(signerKey).add(subdigestKey);
    }
    async loadSubdigestsOfSapientSigner(signer, imageHash) {
        const key = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`;
        const subdigests = this.sapientSignerSubdigests.get(key);
        return subdigests ? Array.from(subdigests).map((s) => s) : [];
    }
    async loadSapientSignatureOfSubdigest(signer, subdigest, imageHash) {
        const key = this.getSapientSignatureKey(signer, subdigest, imageHash);
        const signature = this.sapientSignatures.get(key);
        return signature ? this.deepCopy(signature) : undefined;
    }
    async saveSapientSignatureOfSubdigest(signer, subdigest, imageHash, signature) {
        const key = this.getSapientSignatureKey(signer, subdigest, imageHash);
        this.sapientSignatures.set(key, this.deepCopy(signature));
        const signerKey = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`;
        const subdigestKey = subdigest.toLowerCase();
        if (!this.sapientSignerSubdigests.has(signerKey)) {
            this.sapientSignerSubdigests.set(signerKey, new Set());
        }
        this.sapientSignerSubdigests.get(signerKey).add(subdigestKey);
    }
    async loadTree(rootHash) {
        const tree = this.trees.get(rootHash.toLowerCase());
        return tree ? this.deepCopy(tree) : undefined;
    }
    async saveTree(rootHash, tree) {
        this.trees.set(rootHash.toLowerCase(), this.deepCopy(tree));
    }
}

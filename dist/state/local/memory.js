export class MemoryStore {
    configs = new Map();
    counterfactualWallets = new Map();
    payloads = new Map();
    signerSubdigests = new Map();
    signatures = new Map();
    sapientSignerSubdigests = new Map();
    sapientSignatures = new Map();
    trees = new Map();
    getSignatureKey(signer, subdigest) {
        return `${signer.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    getSapientSignatureKey(signer, subdigest, imageHash) {
        return `${signer.toLowerCase()}-${imageHash.toLowerCase()}-${subdigest.toLowerCase()}`;
    }
    async loadConfig(imageHash) {
        return this.configs.get(imageHash.toLowerCase());
    }
    async saveConfig(imageHash, config) {
        this.configs.set(imageHash.toLowerCase(), config);
    }
    async loadCounterfactualWallet(wallet) {
        return this.counterfactualWallets.get(wallet.toLowerCase());
    }
    async saveCounterfactualWallet(wallet, imageHash, context) {
        this.counterfactualWallets.set(wallet.toLowerCase(), { imageHash, context });
    }
    async loadPayloadOfSubdigest(subdigest) {
        return this.payloads.get(subdigest.toLowerCase());
    }
    async savePayloadOfSubdigest(subdigest, payload) {
        this.payloads.set(subdigest.toLowerCase(), payload);
    }
    async loadSubdigestsOfSigner(signer) {
        const subdigests = this.signerSubdigests.get(signer.toLowerCase());
        return subdigests ? Array.from(subdigests).map((s) => s) : [];
    }
    async loadSignatureOfSubdigest(signer, subdigest) {
        const key = this.getSignatureKey(signer, subdigest);
        return this.signatures.get(key);
    }
    async saveSignatureOfSubdigest(signer, subdigest, signature) {
        const key = this.getSignatureKey(signer, subdigest);
        this.signatures.set(key, signature);
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
        return this.sapientSignatures.get(key);
    }
    async saveSapientSignatureOfSubdigest(signer, subdigest, imageHash, signature) {
        const key = this.getSapientSignatureKey(signer, subdigest, imageHash);
        this.sapientSignatures.set(key, signature);
        const signerKey = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`;
        const subdigestKey = subdigest.toLowerCase();
        if (!this.sapientSignerSubdigests.has(signerKey)) {
            this.sapientSignerSubdigests.set(signerKey, new Set());
        }
        this.sapientSignerSubdigests.get(signerKey).add(subdigestKey);
    }
    async loadTree(rootHash) {
        return this.trees.get(rootHash.toLowerCase());
    }
    async saveTree(rootHash, tree) {
        this.trees.set(rootHash.toLowerCase(), tree);
    }
}

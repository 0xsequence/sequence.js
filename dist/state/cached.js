import { Address } from 'ox';
import { normalizeAddressKeys } from './utils.js';
export class Cached {
    args;
    constructor(args) {
        this.args = args;
    }
    async getConfiguration(imageHash) {
        const cached = await this.args.cache.getConfiguration(imageHash);
        if (cached) {
            return cached;
        }
        const config = await this.args.source.getConfiguration(imageHash);
        if (config) {
            await this.args.cache.saveConfiguration(config);
        }
        return config;
    }
    async getDeploy(wallet) {
        const cached = await this.args.cache.getDeploy(wallet);
        if (cached) {
            return cached;
        }
        const deploy = await this.args.source.getDeploy(wallet);
        if (deploy) {
            await this.args.cache.saveDeploy(deploy.imageHash, deploy.context);
        }
        return deploy;
    }
    async getWallets(signer) {
        // Get both from cache and source
        const cached = normalizeAddressKeys(await this.args.cache.getWallets(signer));
        const source = normalizeAddressKeys(await this.args.source.getWallets(signer));
        // Merge and deduplicate
        const deduplicated = { ...cached, ...source };
        // Sync values to source that are not in cache, and vice versa
        for (const [walletAddress, data] of Object.entries(deduplicated)) {
            Address.assert(walletAddress);
            if (!source[walletAddress]) {
                await this.args.source.saveWitnesses(walletAddress, data.chainId, data.payload, {
                    type: 'unrecovered-signer',
                    weight: 1n,
                    signature: data.signature,
                });
            }
            if (!cached[walletAddress]) {
                await this.args.cache.saveWitnesses(walletAddress, data.chainId, data.payload, {
                    type: 'unrecovered-signer',
                    weight: 1n,
                    signature: data.signature,
                });
            }
        }
        return deduplicated;
    }
    async getWalletsForSapient(signer, imageHash) {
        const cached = await this.args.cache.getWalletsForSapient(signer, imageHash);
        const source = await this.args.source.getWalletsForSapient(signer, imageHash);
        const deduplicated = { ...cached, ...source };
        // Sync values to source that are not in cache, and vice versa
        for (const [wallet, data] of Object.entries(deduplicated)) {
            const walletAddress = Address.from(wallet);
            if (!source[walletAddress]) {
                await this.args.source.saveWitnesses(walletAddress, data.chainId, data.payload, {
                    type: 'unrecovered-signer',
                    weight: 1n,
                    signature: data.signature,
                });
            }
            if (!cached[walletAddress]) {
                await this.args.cache.saveWitnesses(walletAddress, data.chainId, data.payload, {
                    type: 'unrecovered-signer',
                    weight: 1n,
                    signature: data.signature,
                });
            }
        }
        return deduplicated;
    }
    async getWitnessFor(wallet, signer) {
        const cached = await this.args.cache.getWitnessFor(wallet, signer);
        if (cached) {
            return cached;
        }
        const source = await this.args.source.getWitnessFor(wallet, signer);
        if (source) {
            await this.args.cache.saveWitnesses(wallet, source.chainId, source.payload, {
                type: 'unrecovered-signer',
                weight: 1n,
                signature: source.signature,
            });
        }
        return source;
    }
    async getWitnessForSapient(wallet, signer, imageHash) {
        const cached = await this.args.cache.getWitnessForSapient(wallet, signer, imageHash);
        if (cached) {
            return cached;
        }
        const source = await this.args.source.getWitnessForSapient(wallet, signer, imageHash);
        if (source) {
            await this.args.cache.saveWitnesses(wallet, source.chainId, source.payload, {
                type: 'unrecovered-signer',
                weight: 1n,
                signature: source.signature,
            });
        }
        return source;
    }
    async getConfigurationUpdates(wallet, fromImageHash, options) {
        // TODO: Cache this
        return this.args.source.getConfigurationUpdates(wallet, fromImageHash, options);
    }
    async getTree(rootHash) {
        const cached = await this.args.cache.getTree(rootHash);
        if (cached) {
            return cached;
        }
        const source = await this.args.source.getTree(rootHash);
        if (source) {
            await this.args.cache.saveTree(source);
        }
        return source;
    }
    // Write methods are not cached, they are directly forwarded to the source
    saveWallet(deployConfiguration, context) {
        return this.args.source.saveWallet(deployConfiguration, context);
    }
    saveWitnesses(wallet, chainId, payload, signatures) {
        return this.args.source.saveWitnesses(wallet, chainId, payload, signatures);
    }
    saveUpdate(wallet, configuration, signature) {
        return this.args.source.saveUpdate(wallet, configuration, signature);
    }
    saveTree(tree) {
        return this.args.source.saveTree(tree);
    }
    saveConfiguration(config) {
        return this.args.source.saveConfiguration(config);
    }
    saveDeploy(imageHash, context) {
        return this.args.source.saveDeploy(imageHash, context);
    }
    async getPayload(opHash) {
        const cached = await this.args.cache.getPayload(opHash);
        if (cached) {
            return cached;
        }
        const source = await this.args.source.getPayload(opHash);
        if (source) {
            await this.args.cache.savePayload(source.wallet, source.payload, source.chainId);
        }
        return source;
    }
    savePayload(wallet, payload, chainId) {
        return this.args.source.savePayload(wallet, payload, chainId);
    }
}

import { Signers } from '@0xsequence/wallet-core';
import { Kinds } from './types/signer.js';
export class Devices {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    async list() {
        return this.shared.databases.encryptedPks.listAddresses();
    }
    async has(address) {
        const entry = await this.shared.databases.encryptedPks.getEncryptedEntry(address);
        return entry !== undefined;
    }
    async create() {
        const e = await this.shared.databases.encryptedPks.generateAndStore();
        const s = await this.shared.databases.encryptedPks.getEncryptedPkStore(e.address);
        if (!s) {
            throw new Error('Failed to create session');
        }
        this.shared.modules.logger.log('Created new session:', s.address);
        return new Signers.Pk.Pk(s);
    }
    async get(address) {
        const s = await this.shared.databases.encryptedPks.getEncryptedPkStore(address);
        if (!s) {
            return undefined;
        }
        return new Signers.Pk.Pk(s);
    }
    async witness(address, wallet) {
        const signer = await this.get(address);
        if (!signer) {
            throw new Error('Signer not found');
        }
        await signer.witness(this.shared.sequence.stateProvider, wallet, {
            signerKind: Kinds.LocalDevice,
        });
    }
    async remove(address) {
        await this.shared.databases.encryptedPks.remove(address);
    }
}

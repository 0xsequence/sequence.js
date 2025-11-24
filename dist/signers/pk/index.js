import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex, Secp256k1 } from 'ox';
export class MemoryPkStore {
    privateKey;
    constructor(privateKey) {
        this.privateKey = privateKey;
    }
    address() {
        return Address.fromPublicKey(this.publicKey());
    }
    publicKey() {
        return Secp256k1.getPublicKey({ privateKey: this.privateKey });
    }
    signDigest(digest) {
        return Promise.resolve(Secp256k1.sign({ payload: digest, privateKey: this.privateKey }));
    }
}
export class Pk {
    privateKey;
    address;
    pubKey;
    constructor(privateKey) {
        this.privateKey = typeof privateKey === 'string' ? new MemoryPkStore(privateKey) : privateKey;
        this.pubKey = this.privateKey.publicKey();
        this.address = this.privateKey.address();
    }
    async sign(wallet, chainId, payload) {
        const hash = Payload.hash(wallet, chainId, payload);
        return this.signDigest(hash);
    }
    async signDigest(digest) {
        const signature = await this.privateKey.signDigest(digest);
        return { ...signature, type: 'hash' };
    }
    async witness(stateWriter, wallet, extra) {
        const payload = Payload.fromMessage(Hex.fromString(JSON.stringify({
            action: 'consent-to-be-part-of-wallet',
            wallet,
            signer: this.address,
            timestamp: Date.now(),
            ...extra,
        })));
        const signature = await this.sign(wallet, 0, payload);
        await stateWriter.saveWitnesses(wallet, 0, payload, {
            type: 'unrecovered-signer',
            weight: 1n,
            signature,
        });
    }
}
export * as Encrypted from './encrypted.js';

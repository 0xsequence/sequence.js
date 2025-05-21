import { Hex } from 'ox';
import { IdentityInstrument as IdentityInstrumentRpc, KeyType, IdentityType, AuthMode, } from './identity-instrument.gen.js';
export { KeyType, IdentityType, AuthMode };
export * from './challenge.js';
export class IdentityInstrument {
    rpc;
    constructor(hostname, fetch = window.fetch) {
        this.rpc = new IdentityInstrumentRpc(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch);
    }
    async commitVerifier(authKey, challenge) {
        return this.rpc.commitVerifier({
            params: {
                ...challenge.getCommitParams(),
                authKey: {
                    publicKey: authKey.address,
                    keyType: authKey.keyType,
                },
            },
        });
    }
    async completeAuth(authKey, challenge) {
        return this.rpc.completeAuth({
            params: {
                ...challenge.getCompleteParams(),
                authKey: {
                    publicKey: authKey.address,
                    keyType: authKey.keyType,
                },
            },
        });
    }
    async sign(authKey, digest) {
        const res = await this.rpc.sign({
            params: {
                signer: authKey.signer,
                digest: Hex.fromBytes(digest),
                authKey: {
                    publicKey: authKey.address,
                    keyType: authKey.keyType,
                },
                signature: await authKey.sign(digest),
            },
        });
        Hex.assert(res.signature);
        return res.signature;
    }
}

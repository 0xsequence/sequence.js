import { Hex, Bytes } from 'ox';
import { canonicalize } from 'json-canonicalize';
import { IdentityInstrument as IdentityInstrumentRpc, KeyType, IdentityType, AuthMode, } from './identity-instrument.gen.js';
export * as Client from './identity-instrument.gen.js';
export { KeyType, IdentityType, AuthMode };
export * from './challenge.js';
export class IdentityInstrument {
    scope;
    rpc;
    constructor(hostname, scope, fetch = window.fetch) {
        this.rpc = new IdentityInstrumentRpc(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch);
        this.scope = scope;
    }
    async commitVerifier(authKey, challenge) {
        const params = {
            ...challenge.getCommitParams(),
            scope: this.scope,
        };
        const signature = await authKey.sign(Bytes.fromString(canonicalize(params)));
        return this.rpc.commitVerifier({
            params,
            authKey: {
                address: authKey.address,
                keyType: authKey.keyType,
            },
            signature,
        });
    }
    async completeAuth(authKey, challenge) {
        const params = {
            ...challenge.getCompleteParams(),
            signerType: KeyType.Ethereum_Secp256k1,
            scope: this.scope,
        };
        const signature = await authKey.sign(Bytes.fromString(canonicalize(params)));
        return this.rpc.completeAuth({
            params,
            authKey: {
                address: authKey.address,
                keyType: authKey.keyType,
            },
            signature,
        });
    }
    async sign(authKey, digest) {
        const params = {
            scope: this.scope,
            signer: {
                address: authKey.signer,
                keyType: KeyType.Ethereum_Secp256k1,
            },
            digest: Hex.fromBytes(digest),
            nonce: Hex.fromNumber(Date.now()),
        };
        const res = await this.rpc.sign({
            params,
            authKey: {
                address: authKey.address,
                keyType: authKey.keyType,
            },
            signature: await authKey.sign(Bytes.fromString(canonicalize(params))),
        });
        Hex.assert(res.signature);
        return res.signature;
    }
}

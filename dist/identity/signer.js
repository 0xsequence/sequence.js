import { Address, Signature, Hex } from 'ox';
import { Payload } from '@0xsequence/wallet-primitives';
import * as Identity from '@0xsequence/identity-instrument';
export function toIdentityAuthKey(authKey) {
    return {
        address: authKey.address,
        keyType: Identity.KeyType.WebCrypto_Secp256r1,
        signer: authKey.identitySigner,
        async sign(digest) {
            const authKeySignature = await window.crypto.subtle.sign({
                name: 'ECDSA',
                hash: 'SHA-256',
            }, authKey.privateKey, digest);
            return Hex.fromBytes(new Uint8Array(authKeySignature));
        },
    };
}
export class IdentitySigner {
    identityInstrument;
    authKey;
    constructor(identityInstrument, authKey) {
        this.identityInstrument = identityInstrument;
        this.authKey = authKey;
    }
    get address() {
        if (!Address.validate(this.authKey.identitySigner)) {
            throw new Error('No signer address found');
        }
        return Address.checksum(this.authKey.identitySigner);
    }
    async sign(wallet, chainId, payload) {
        const payloadHash = Payload.hash(wallet, chainId, payload);
        return this.signDigest(payloadHash);
    }
    async signDigest(digest) {
        const sigHex = await this.identityInstrument.sign(toIdentityAuthKey(this.authKey), digest);
        const sig = Signature.fromHex(sigHex);
        return {
            type: 'hash',
            ...sig,
        };
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

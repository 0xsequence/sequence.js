import { Hex } from 'ox';
import * as Identity from '@0xsequence/identity-instrument';
import { IdentitySigner, toIdentityAuthKey } from '../../identity/signer.js';
export const identityTypeToHex = (identityType) => {
    // Bytes4
    switch (identityType) {
        case Identity.IdentityType.Email:
            return '0x00000001';
        case Identity.IdentityType.OIDC:
            return '0x00000002';
        default:
            // Unknown identity type
            return '0xffffffff';
    }
};
export class IdentityHandler {
    nitro;
    authKeys;
    signatures;
    identityType;
    constructor(nitro, authKeys, signatures, identityType) {
        this.nitro = nitro;
        this.authKeys = authKeys;
        this.signatures = signatures;
        this.identityType = identityType;
    }
    onStatusChange(cb) {
        return this.authKeys.addListener(cb);
    }
    async nitroCommitVerifier(challenge) {
        await this.authKeys.delBySigner('');
        const authKey = await this.getAuthKey('');
        if (!authKey) {
            throw new Error('no-auth-key');
        }
        const res = await this.nitro.commitVerifier(toIdentityAuthKey(authKey), challenge);
        return res;
    }
    async nitroCompleteAuth(challenge) {
        const authKey = await this.getAuthKey('');
        if (!authKey) {
            throw new Error('no-auth-key');
        }
        const res = await this.nitro.completeAuth(toIdentityAuthKey(authKey), challenge);
        authKey.identitySigner = res.signer.address;
        authKey.expiresAt = new Date(Date.now() + 1000 * 60 * 3); // 3 minutes
        await this.authKeys.delBySigner('');
        await this.authKeys.delBySigner(authKey.identitySigner);
        await this.authKeys.set(authKey);
        const signer = new IdentitySigner(this.nitro, authKey);
        return { signer, email: res.identity.email };
    }
    async sign(signer, request) {
        const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload);
        await this.signatures.addSignature(request.id, {
            address: signer.address,
            signature,
        });
    }
    async getAuthKeySigner(address) {
        const authKey = await this.getAuthKey(address);
        if (!authKey) {
            return undefined;
        }
        return new IdentitySigner(this.nitro, authKey);
    }
    async getAuthKey(signer) {
        let authKey = await this.authKeys.getBySigner(signer);
        if (!signer && !authKey) {
            const keyPair = await window.crypto.subtle.generateKey({
                name: 'ECDSA',
                namedCurve: 'P-256',
            }, false, ['sign', 'verify']);
            const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
            authKey = {
                address: Hex.fromBytes(new Uint8Array(publicKey)),
                identitySigner: '',
                expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
                privateKey: keyPair.privateKey,
            };
            await this.authKeys.set(authKey);
        }
        return authKey;
    }
}

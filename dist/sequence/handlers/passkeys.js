import { Signers } from '@0xsequence/wallet-core';
import { Kinds } from '../types/signer.js';
export class PasskeysHandler {
    signatures;
    extensions;
    stateReader;
    kind = Kinds.LoginPasskey;
    constructor(signatures, extensions, stateReader) {
        this.signatures = signatures;
        this.extensions = extensions;
        this.stateReader = stateReader;
    }
    onStatusChange(cb) {
        return () => { };
    }
    async loadPasskey(wallet, imageHash) {
        try {
            return await Signers.Passkey.Passkey.loadFromWitness(this.stateReader, this.extensions, wallet, imageHash);
        }
        catch (e) {
            console.warn('Failed to load passkey:', e);
            return undefined;
        }
    }
    async status(address, imageHash, request) {
        const base = { address, imageHash, handler: this };
        if (address !== this.extensions.passkeys) {
            console.warn('PasskeySigner: status address does not match passkey module address', address, this.extensions.passkeys);
            const status = {
                ...base,
                status: 'unavailable',
                reason: 'unknown-error',
            };
            return status;
        }
        const passkey = imageHash && (await this.loadPasskey(request.envelope.wallet, imageHash));
        if (!passkey) {
            console.warn('PasskeySigner: status failed to load passkey', address, imageHash);
            const status = {
                ...base,
                status: 'unavailable',
                reason: 'unknown-error',
            };
            return status;
        }
        const status = {
            ...base,
            status: 'actionable',
            message: 'request-interaction-with-passkey',
            imageHash: imageHash,
            handle: async () => {
                const signature = await passkey.signSapient(request.envelope.wallet, request.envelope.chainId, request.envelope.payload, imageHash);
                await this.signatures.addSignature(request.id, {
                    address,
                    imageHash,
                    signature,
                });
                return true;
            },
        };
        return status;
    }
}

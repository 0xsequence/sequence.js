import { Signers } from '@0xsequence/wallet-core';
import { Kinds } from '../types/signer.js';
export class PasskeysHandler {
    signatures;
    extensions;
    stateReader;
    kind = Kinds.LoginPasskey;
    readySigners = new Map();
    constructor(signatures, extensions, stateReader) {
        this.signatures = signatures;
        this.extensions = extensions;
        this.stateReader = stateReader;
    }
    onStatusChange(cb) {
        return () => { };
    }
    addReadySigner(signer) {
        // Use credentialId as key to match specific passkey instances
        this.readySigners.set(signer.credentialId, signer);
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
        // First check if we have a ready signer that matches the imageHash
        let passkey;
        // Look for a ready signer with matching imageHash
        for (const readySigner of this.readySigners.values()) {
            if (imageHash && readySigner.imageHash === imageHash) {
                passkey = readySigner;
                break;
            }
        }
        // If no ready signer found, fall back to loading from witness
        if (!passkey && imageHash) {
            passkey = await this.loadPasskey(request.envelope.wallet, imageHash);
        }
        if (!passkey) {
            console.warn('PasskeySigner: status failed to load passkey', address, imageHash);
            const status = {
                ...base,
                status: 'unavailable',
                reason: 'unknown-error',
            };
            return status;
        }
        // At this point, we know imageHash is defined because we have a passkey
        if (!imageHash) {
            throw new Error('imageHash is required for passkey operations');
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

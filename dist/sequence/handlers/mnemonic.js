import { Signers } from '@0xsequence/wallet-core';
import { Address, Hex, Mnemonic } from 'ox';
import { Kinds } from '../types/signer.js';
export class MnemonicHandler {
    signatures;
    kind = Kinds.LoginMnemonic;
    onPromptMnemonic;
    readySigners = new Map();
    constructor(signatures) {
        this.signatures = signatures;
    }
    registerUI(onPromptMnemonic) {
        this.onPromptMnemonic = onPromptMnemonic;
        return () => {
            this.onPromptMnemonic = undefined;
        };
    }
    unregisterUI() {
        this.onPromptMnemonic = undefined;
    }
    addReadySigner(signer) {
        this.readySigners.set(signer.address.toLowerCase(), signer);
    }
    onStatusChange(_cb) {
        return () => { };
    }
    static toSigner(mnemonic) {
        try {
            const pk = Mnemonic.toPrivateKey(mnemonic);
            return new Signers.Pk.Pk(Hex.from(pk));
        }
        catch {
            return undefined;
        }
    }
    async status(address, _imageHash, request) {
        // Check if we have a cached signer for this address
        const signer = this.readySigners.get(address.toLowerCase());
        if (signer) {
            return {
                address,
                handler: this,
                status: 'ready',
                handle: async () => {
                    const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload);
                    await this.signatures.addSignature(request.id, {
                        address,
                        signature,
                    });
                    // Remove the ready signer after use
                    this.readySigners.delete(address.toLowerCase());
                    return true;
                },
            };
        }
        const onPromptMnemonic = this.onPromptMnemonic;
        if (!onPromptMnemonic) {
            return {
                address,
                handler: this,
                reason: 'ui-not-registered',
                status: 'unavailable',
            };
        }
        return {
            address,
            handler: this,
            status: 'actionable',
            message: 'enter-mnemonic',
            handle: () => new Promise(async (resolve, reject) => {
                const respond = async (mnemonic) => {
                    const signer = MnemonicHandler.toSigner(mnemonic);
                    if (!signer) {
                        return reject('invalid-mnemonic');
                    }
                    if (!Address.isEqual(signer.address, address)) {
                        return reject('wrong-mnemonic');
                    }
                    const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload);
                    await this.signatures.addSignature(request.id, {
                        address,
                        signature,
                    });
                    resolve(true);
                };
                await onPromptMnemonic(respond);
            }),
        };
    }
}

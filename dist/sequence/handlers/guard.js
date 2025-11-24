import * as Guard from '@0xsequence/guard';
import { Kinds } from '../types/index.js';
export class GuardHandler {
    signatures;
    guards;
    kind = Kinds.Guard;
    onPromptCode;
    constructor(signatures, guards) {
        this.signatures = signatures;
        this.guards = guards;
    }
    registerUI(onPromptCode) {
        this.onPromptCode = onPromptCode;
        return () => {
            this.onPromptCode = undefined;
        };
    }
    unregisterUI() {
        this.onPromptCode = undefined;
    }
    onStatusChange(cb) {
        return () => { };
    }
    async status(address, _imageHash, request) {
        const guardInfo = this.guards.getByAddress(address);
        if (!guardInfo) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'guard-not-found',
            };
        }
        const [role, guard] = guardInfo;
        if (role !== 'wallet') {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'not-wallet-guard',
            };
        }
        const onPromptCode = this.onPromptCode;
        if (!onPromptCode) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'guard-ui-not-registered',
            };
        }
        if (request.envelope.signatures.length === 0) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'must-not-sign-first',
            };
        }
        return {
            address,
            handler: this,
            status: 'ready',
            handle: () => new Promise(async (resolve, reject) => {
                try {
                    const signature = await guard.signEnvelope(request.envelope);
                    await this.signatures.addSignature(request.id, signature);
                    resolve(true);
                }
                catch (e) {
                    if (e instanceof Guard.AuthRequiredError) {
                        const respond = async (token) => {
                            try {
                                const signature = await guard.signEnvelope(request.envelope, token);
                                await this.signatures.addSignature(request.id, signature);
                                resolve(true);
                            }
                            catch (e) {
                                reject(e);
                            }
                        };
                        await onPromptCode(request, e.id, respond);
                    }
                    else {
                        reject(e);
                    }
                }
            }),
        };
    }
}

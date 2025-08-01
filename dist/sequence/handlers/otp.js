import * as Identity from '@0xsequence/identity-instrument';
import { Kinds } from '../types/signer.js';
import { IdentityHandler } from './identity.js';
export class OtpHandler extends IdentityHandler {
    kind = Kinds.LoginEmailOtp;
    onPromptOtp;
    constructor(nitro, signatures, authKeys) {
        super(nitro, authKeys, signatures, Identity.IdentityType.Email);
    }
    registerUI(onPromptOtp) {
        this.onPromptOtp = onPromptOtp;
        return () => {
            this.onPromptOtp = undefined;
        };
    }
    unregisterUI() {
        this.onPromptOtp = undefined;
    }
    async getSigner(email) {
        const onPromptOtp = this.onPromptOtp;
        if (!onPromptOtp) {
            throw new Error('otp-handler-ui-not-registered');
        }
        const challenge = Identity.OtpChallenge.fromRecipient(this.identityType, email);
        const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge);
        return new Promise(async (resolve, reject) => {
            const respond = async (otp) => {
                try {
                    const { signer, email: returnedEmail } = await this.nitroCompleteAuth(challenge.withAnswer(codeChallenge, otp));
                    resolve({ signer, email: returnedEmail });
                }
                catch (e) {
                    reject(e);
                }
            };
            await onPromptOtp(loginHint, respond);
        });
    }
    async status(address, _imageHash, request) {
        const signer = await this.getAuthKeySigner(address);
        if (signer) {
            return {
                address,
                handler: this,
                status: 'ready',
                handle: async () => {
                    await this.sign(signer, request);
                    return true;
                },
            };
        }
        const onPromptOtp = this.onPromptOtp;
        if (!onPromptOtp) {
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
            message: 'request-otp',
            handle: () => new Promise(async (resolve, reject) => {
                const challenge = Identity.OtpChallenge.fromSigner(this.identityType, {
                    address,
                    keyType: Identity.KeyType.Secp256k1,
                });
                const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge);
                const respond = async (otp) => {
                    try {
                        await this.nitroCompleteAuth(challenge.withAnswer(codeChallenge, otp));
                        resolve(true);
                    }
                    catch (e) {
                        resolve(false);
                    }
                };
                await onPromptOtp(loginHint, respond);
            }),
        };
    }
}

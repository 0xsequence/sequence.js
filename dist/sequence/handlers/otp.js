import * as Identity from '@0xsequence/identity-instrument';
import { Kinds } from '../types/signer.js';
import { IdentityHandler } from './identity.js';
import { AnswerIncorrectError, ChallengeExpiredError, TooManyAttemptsError } from '../errors.js';
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
        return await this.handleAuth(challenge, onPromptOtp);
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
            handle: async () => {
                const challenge = Identity.OtpChallenge.fromSigner(this.identityType, {
                    address,
                    keyType: Identity.KeyType.Ethereum_Secp256k1,
                });
                try {
                    await this.handleAuth(challenge, onPromptOtp);
                    return true;
                }
                catch (e) {
                    return false;
                }
            },
        };
    }
    handleAuth(challenge, onPromptOtp) {
        return new Promise(async (resolve, reject) => {
            try {
                const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge);
                const respond = async (otp) => {
                    try {
                        const { signer, email: returnedEmail } = await this.nitroCompleteAuth(challenge.withAnswer(codeChallenge, otp));
                        resolve({ signer, email: returnedEmail });
                    }
                    catch (e) {
                        if (e instanceof Identity.Client.AnswerIncorrectError) {
                            // Keep the handle promise unresolved so that respond can be retried
                            throw new AnswerIncorrectError();
                        }
                        else if (e instanceof Identity.Client.ChallengeExpiredError) {
                            reject(e);
                            throw new ChallengeExpiredError();
                        }
                        else if (e instanceof Identity.Client.TooManyAttemptsError) {
                            reject(e);
                            throw new TooManyAttemptsError();
                        }
                        else {
                            reject(e);
                        }
                    }
                };
                await onPromptOtp(loginHint, respond);
            }
            catch (e) {
                reject(e);
            }
        });
    }
}

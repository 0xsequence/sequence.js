import { IdentityType, AuthMode, Key } from './identity-instrument.gen.js';
interface CommitChallengeParams {
    authMode: AuthMode;
    identityType: IdentityType;
    handle?: string;
    signer?: Key;
    metadata: {
        [key: string]: string;
    };
}
interface CompleteChallengeParams {
    authMode: AuthMode;
    identityType: IdentityType;
    verifier: string;
    answer: string;
}
export declare abstract class Challenge {
    abstract getCommitParams(): CommitChallengeParams;
    abstract getCompleteParams(): CompleteChallengeParams;
}
export declare class IdTokenChallenge extends Challenge {
    readonly issuer: string;
    readonly audience: string;
    readonly idToken: string;
    private handle;
    private exp;
    constructor(issuer: string, audience: string, idToken: string);
    getCommitParams(): CommitChallengeParams;
    getCompleteParams(): CompleteChallengeParams;
}
export declare class AuthCodeChallenge extends Challenge {
    readonly issuer: string;
    readonly audience: string;
    readonly redirectUri: string;
    readonly authCode: string;
    private handle;
    private signer?;
    constructor(issuer: string, audience: string, redirectUri: string, authCode: string);
    getCommitParams(): CommitChallengeParams;
    getCompleteParams(): CompleteChallengeParams;
    withSigner(signer: Key): AuthCodeChallenge;
}
export declare class AuthCodePkceChallenge extends Challenge {
    readonly issuer: string;
    readonly audience: string;
    readonly redirectUri: string;
    private verifier?;
    private authCode?;
    private signer?;
    constructor(issuer: string, audience: string, redirectUri: string);
    getCommitParams(): CommitChallengeParams;
    getCompleteParams(): CompleteChallengeParams;
    withSigner(signer: Key): AuthCodePkceChallenge;
    withAnswer(verifier: string, authCode: string): AuthCodePkceChallenge;
}
export declare class OtpChallenge extends Challenge {
    readonly identityType: IdentityType;
    private answer?;
    private recipient?;
    private signer?;
    private constructor();
    static fromRecipient(identityType: IdentityType, recipient: string): OtpChallenge;
    static fromSigner(identityType: IdentityType, signer: Key): OtpChallenge;
    getCommitParams(): CommitChallengeParams;
    getCompleteParams(): CompleteChallengeParams;
    withAnswer(codeChallenge: string, otp: string): OtpChallenge;
}
export {};
//# sourceMappingURL=challenge.d.ts.map
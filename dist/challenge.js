import { Bytes, Hash, Hex } from 'ox';
import { jwtDecode } from 'jwt-decode';
import { IdentityType, AuthMode } from './identity-instrument.gen.js';
export class Challenge {
}
export class IdTokenChallenge extends Challenge {
    issuer;
    audience;
    idToken;
    handle = '';
    exp = '';
    constructor(issuer, audience, idToken) {
        super();
        this.issuer = issuer;
        this.audience = audience;
        this.idToken = idToken;
        const decoded = jwtDecode(this.idToken);
        const idTokenHash = Hash.keccak256(new TextEncoder().encode(this.idToken));
        this.handle = Hex.fromBytes(idTokenHash);
        this.exp = decoded.exp?.toString() ?? '';
    }
    getCommitParams() {
        return {
            authMode: AuthMode.IDToken,
            identityType: IdentityType.OIDC,
            handle: this.handle,
            metadata: {
                iss: this.issuer,
                aud: this.audience,
                exp: this.exp,
            },
        };
    }
    getCompleteParams() {
        return {
            authMode: AuthMode.IDToken,
            identityType: IdentityType.OIDC,
            verifier: this.handle,
            answer: this.idToken,
        };
    }
}
export class AuthCodeChallenge extends Challenge {
    issuer;
    audience;
    redirectUri;
    authCode;
    handle = '';
    signer;
    constructor(issuer, audience, redirectUri, authCode) {
        super();
        this.issuer = issuer;
        this.audience = audience;
        this.redirectUri = redirectUri;
        this.authCode = authCode;
        const authCodeHash = Hash.keccak256(new TextEncoder().encode(this.authCode));
        this.handle = Hex.fromBytes(authCodeHash);
    }
    getCommitParams() {
        return {
            authMode: AuthMode.AuthCode,
            identityType: IdentityType.OIDC,
            signer: this.signer,
            handle: this.handle,
            metadata: {
                iss: this.issuer,
                aud: this.audience,
                redirect_uri: this.redirectUri,
            },
        };
    }
    getCompleteParams() {
        return {
            authMode: AuthMode.AuthCode,
            identityType: IdentityType.OIDC,
            verifier: this.handle,
            answer: this.authCode,
        };
    }
    withSigner(signer) {
        const challenge = new AuthCodeChallenge(this.issuer, this.audience, this.redirectUri, this.authCode);
        challenge.handle = this.handle;
        challenge.signer = signer;
        return challenge;
    }
}
export class AuthCodePkceChallenge extends Challenge {
    issuer;
    audience;
    redirectUri;
    verifier;
    authCode;
    signer;
    constructor(issuer, audience, redirectUri) {
        super();
        this.issuer = issuer;
        this.audience = audience;
        this.redirectUri = redirectUri;
    }
    getCommitParams() {
        return {
            authMode: AuthMode.AuthCodePKCE,
            identityType: IdentityType.OIDC,
            signer: this.signer,
            metadata: {
                iss: this.issuer,
                aud: this.audience,
                redirect_uri: this.redirectUri,
            },
        };
    }
    getCompleteParams() {
        if (!this.verifier || !this.authCode) {
            throw new Error('AuthCodePkceChallenge is not complete');
        }
        return {
            authMode: AuthMode.AuthCodePKCE,
            identityType: IdentityType.OIDC,
            verifier: this.verifier,
            answer: this.authCode,
        };
    }
    withSigner(signer) {
        const challenge = new AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri);
        challenge.verifier = this.verifier;
        challenge.signer = signer;
        return challenge;
    }
    withAnswer(verifier, authCode) {
        const challenge = new AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri);
        challenge.signer = this.signer;
        challenge.verifier = verifier;
        challenge.authCode = authCode;
        return challenge;
    }
}
export class OtpChallenge extends Challenge {
    identityType;
    answer;
    recipient;
    signer;
    constructor(identityType) {
        super();
        this.identityType = identityType;
    }
    static fromRecipient(identityType, recipient) {
        const challenge = new OtpChallenge(identityType);
        challenge.recipient = recipient;
        return challenge;
    }
    static fromSigner(identityType, signer) {
        const challenge = new OtpChallenge(identityType);
        challenge.signer = signer;
        return challenge;
    }
    getCommitParams() {
        if (!this.recipient && (!this.signer || !this.signer.address || !this.signer.keyType)) {
            throw new Error('OtpChallenge is not complete');
        }
        return {
            authMode: AuthMode.OTP,
            identityType: this.identityType,
            handle: this.recipient,
            signer: this.signer,
            metadata: {},
        };
    }
    getCompleteParams() {
        if (!this.answer || (!this.recipient && !this.signer)) {
            throw new Error('OtpChallenge is not complete');
        }
        return {
            authMode: AuthMode.OTP,
            identityType: this.identityType,
            verifier: this.recipient ?? (this.signer ? `${this.signer.keyType}:${this.signer.address}` : ''),
            answer: this.answer,
        };
    }
    withAnswer(codeChallenge, otp) {
        const challenge = new OtpChallenge(this.identityType);
        challenge.recipient = this.recipient;
        challenge.signer = this.signer;
        const answerHash = Hash.keccak256(Bytes.fromString(codeChallenge + otp));
        challenge.answer = Hex.fromBytes(answerHash);
        return challenge;
    }
}

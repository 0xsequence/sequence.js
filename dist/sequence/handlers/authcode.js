import { Hex, Bytes } from 'ox';
import * as Identity from '@0xsequence/identity-instrument';
import { IdentityHandler } from './identity.js';
export class AuthCodeHandler extends IdentityHandler {
    signupKind;
    issuer;
    audience;
    commitments;
    redirectUri = '';
    constructor(signupKind, issuer, audience, nitro, signatures, commitments, authKeys) {
        super(nitro, authKeys, signatures, Identity.IdentityType.OIDC);
        this.signupKind = signupKind;
        this.issuer = issuer;
        this.audience = audience;
        this.commitments = commitments;
    }
    get kind() {
        return 'login-' + this.signupKind;
    }
    setRedirectUri(redirectUri) {
        this.redirectUri = redirectUri;
    }
    async commitAuth(target, isSignUp, state, signer) {
        if (!state) {
            state = Hex.fromBytes(Bytes.random(32));
        }
        await this.commitments.set({
            id: state,
            kind: this.signupKind,
            signer,
            target,
            metadata: {},
            isSignUp,
        });
        const searchParams = new URLSearchParams({
            client_id: this.audience,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'openid',
            state,
        });
        const oauthUrl = this.oauthUrl();
        return `${oauthUrl}?${searchParams.toString()}`;
    }
    async completeAuth(commitment, code) {
        let challenge = new Identity.AuthCodeChallenge(this.issuer, this.audience, this.redirectUri, code);
        if (commitment.signer) {
            challenge = challenge.withSigner({ address: commitment.signer, keyType: Identity.KeyType.Ethereum_Secp256k1 });
        }
        await this.nitroCommitVerifier(challenge);
        const { signer, email } = await this.nitroCompleteAuth(challenge);
        return [signer, { email }];
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
        return {
            address,
            handler: this,
            status: 'actionable',
            message: 'request-redirect',
            handle: async () => {
                const url = await this.commitAuth(window.location.pathname, false, request.id, address);
                window.location.href = url;
                return true;
            },
        };
    }
    oauthUrl() {
        switch (this.issuer) {
            case 'https://accounts.google.com':
                return 'https://accounts.google.com/o/oauth2/v2/auth';
            case 'https://appleid.apple.com':
                return 'https://appleid.apple.com/auth/authorize';
            default:
                throw new Error('unsupported-issuer');
        }
    }
}

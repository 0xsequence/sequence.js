import { Hex, Bytes } from 'ox';
import * as Identity from '@0xsequence/identity-instrument';
import { AuthCodeHandler } from './authcode.js';
export class AuthCodePkceHandler extends AuthCodeHandler {
    constructor(signupKind, issuer, audience, nitro, signatures, commitments, authKeys) {
        super(signupKind, issuer, audience, nitro, signatures, commitments, authKeys);
    }
    async commitAuth(target, isSignUp, state, signer) {
        let challenge = new Identity.AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri);
        if (signer) {
            challenge = challenge.withSigner({ address: signer, keyType: Identity.KeyType.Ethereum_Secp256k1 });
        }
        const { verifier, loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge);
        if (!state) {
            state = Hex.fromBytes(Bytes.random(32));
        }
        await this.commitments.set({
            id: state,
            kind: this.signupKind,
            verifier,
            challenge: codeChallenge,
            target,
            metadata: {},
            isSignUp,
        });
        const searchParams = new URLSearchParams({
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            client_id: this.audience,
            redirect_uri: this.redirectUri,
            login_hint: loginHint,
            response_type: 'code',
            scope: 'openid profile email',
            state,
        });
        const oauthUrl = this.oauthUrl();
        return `${oauthUrl}?${searchParams.toString()}`;
    }
    async completeAuth(commitment, code) {
        const challenge = new Identity.AuthCodePkceChallenge('', '', '');
        if (!commitment.verifier) {
            throw new Error('Missing verifier in commitment');
        }
        const { signer, email } = await this.nitroCompleteAuth(challenge.withAnswer(commitment.verifier, code));
        await this.commitments.del(commitment.id);
        return [signer, { ...commitment.metadata, email }];
    }
}

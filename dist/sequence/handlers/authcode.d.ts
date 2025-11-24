import { Hex, Address } from 'ox';
import { Handler } from './handler.js';
import * as Db from '../../dbs/index.js';
import { Signatures } from '../signatures.js';
import * as Identity from '@0xsequence/identity-instrument';
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js';
import { IdentitySigner } from '../../identity/signer.js';
import { IdentityHandler } from './identity.js';
export declare class AuthCodeHandler extends IdentityHandler implements Handler {
    readonly signupKind: 'apple' | 'google-pkce';
    readonly issuer: string;
    readonly audience: string;
    protected readonly commitments: Db.AuthCommitments;
    protected redirectUri: string;
    constructor(signupKind: 'apple' | 'google-pkce', issuer: string, audience: string, nitro: Identity.IdentityInstrument, signatures: Signatures, commitments: Db.AuthCommitments, authKeys: Db.AuthKeys);
    get kind(): string;
    setRedirectUri(redirectUri: string): void;
    commitAuth(target: string, isSignUp: boolean, state?: string, signer?: string): Promise<string>;
    completeAuth(commitment: Db.AuthCommitment, code: string): Promise<[IdentitySigner, {
        [key: string]: string;
    }]>;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
    protected oauthUrl(): "https://accounts.google.com/o/oauth2/v2/auth" | "https://appleid.apple.com/auth/authorize";
}
//# sourceMappingURL=authcode.d.ts.map
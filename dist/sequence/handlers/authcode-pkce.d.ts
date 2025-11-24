import { Handler } from './handler.js';
import * as Db from '../../dbs/index.js';
import { Signatures } from '../signatures.js';
import * as Identity from '@0xsequence/identity-instrument';
import { IdentitySigner } from '../../identity/signer.js';
import { AuthCodeHandler } from './authcode.js';
export declare class AuthCodePkceHandler extends AuthCodeHandler implements Handler {
    constructor(signupKind: 'google-pkce', issuer: string, audience: string, nitro: Identity.IdentityInstrument, signatures: Signatures, commitments: Db.AuthCommitments, authKeys: Db.AuthKeys);
    commitAuth(target: string, isSignUp: boolean, state?: string, signer?: string): Promise<string>;
    completeAuth(commitment: Db.AuthCommitment, code: string): Promise<[IdentitySigner, {
        [key: string]: string;
    }]>;
}
//# sourceMappingURL=authcode-pkce.d.ts.map
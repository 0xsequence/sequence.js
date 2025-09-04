import { Generic } from './generic.js';
export type AuthCommitment = {
    id: string;
    kind: 'google-pkce' | 'apple';
    metadata: {
        [key: string]: string;
    };
    verifier?: string;
    challenge?: string;
    target: string;
    isSignUp: boolean;
    signer?: string;
};
export declare class AuthCommitments extends Generic<AuthCommitment, 'id'> {
    constructor(dbName?: string);
}
//# sourceMappingURL=auth-commitments.d.ts.map
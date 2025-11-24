import { Hex } from 'ox';
import * as Db from '../../dbs/index.js';
import * as Identity from '@0xsequence/identity-instrument';
import { Signatures } from '../signatures.js';
import { BaseSignatureRequest } from '../types/signature-request.js';
import { IdentitySigner } from '../../identity/signer.js';
export declare const identityTypeToHex: (identityType?: Identity.IdentityType) => Hex.Hex;
export declare class IdentityHandler {
    private readonly nitro;
    private readonly authKeys;
    private readonly signatures;
    readonly identityType: Identity.IdentityType;
    constructor(nitro: Identity.IdentityInstrument, authKeys: Db.AuthKeys, signatures: Signatures, identityType: Identity.IdentityType);
    onStatusChange(cb: () => void): () => void;
    protected nitroCommitVerifier(challenge: Identity.Challenge): Promise<Identity.Client.CommitVerifierReturn>;
    protected nitroCompleteAuth(challenge: Identity.Challenge): Promise<{
        signer: IdentitySigner;
        email: string;
    }>;
    protected sign(signer: IdentitySigner, request: BaseSignatureRequest): Promise<void>;
    protected getAuthKeySigner(address: string): Promise<IdentitySigner | undefined>;
    private getAuthKey;
}
//# sourceMappingURL=identity.d.ts.map
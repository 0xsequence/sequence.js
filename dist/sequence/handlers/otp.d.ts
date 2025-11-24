import { Hex, Address } from 'ox';
import { Signers } from '@0xsequence/wallet-core';
import * as Identity from '@0xsequence/identity-instrument';
import { Handler } from './handler.js';
import * as Db from '../../dbs/index.js';
import { Signatures } from '../signatures.js';
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js';
import { IdentityHandler } from './identity.js';
type RespondFn = (otp: string) => Promise<void>;
export type PromptOtpHandler = (recipient: string, respond: RespondFn) => Promise<void>;
export declare class OtpHandler extends IdentityHandler implements Handler {
    kind: "login-email-otp";
    private onPromptOtp;
    constructor(nitro: Identity.IdentityInstrument, signatures: Signatures, authKeys: Db.AuthKeys);
    registerUI(onPromptOtp: PromptOtpHandler): () => void;
    unregisterUI(): void;
    getSigner(email: string): Promise<{
        signer: Signers.Signer & Signers.Witnessable;
        email: string;
    }>;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
    private handleAuth;
}
export {};
//# sourceMappingURL=otp.d.ts.map
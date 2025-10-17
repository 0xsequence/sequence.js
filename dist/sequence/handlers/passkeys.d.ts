import { Signers, State } from '@0xsequence/wallet-core';
import { Address, Hex } from 'ox';
import { Signatures } from '../signatures.js';
import { Extensions } from '@0xsequence/wallet-primitives';
import { Handler } from './handler.js';
import { SignerActionable, SignerUnavailable, BaseSignatureRequest } from '../types/index.js';
export declare class PasskeysHandler implements Handler {
    private readonly signatures;
    private readonly extensions;
    private readonly stateReader;
    kind: "login-passkey";
    private readySigners;
    constructor(signatures: Signatures, extensions: Pick<Extensions.Extensions, 'passkeys'>, stateReader: State.Reader);
    onStatusChange(cb: () => void): () => void;
    addReadySigner(signer: Signers.Passkey.Passkey): void;
    private loadPasskey;
    status(address: Address.Address, imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerActionable | SignerUnavailable>;
}
//# sourceMappingURL=passkeys.d.ts.map
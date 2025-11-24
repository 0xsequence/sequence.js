import { Address, Hex } from 'ox';
import { Signers } from '@0xsequence/wallet-core';
import { Handler } from './handler.js';
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable } from '../types/index.js';
import { Signatures } from '../signatures.js';
import { Guards } from '../guards.js';
type RespondFn = (token: Signers.GuardToken) => Promise<void>;
export type PromptCodeHandler = (request: BaseSignatureRequest, codeType: 'TOTP' | 'PIN', respond: RespondFn) => Promise<void>;
export declare class GuardHandler implements Handler {
    private readonly signatures;
    private readonly guards;
    kind: "guard-extension";
    private onPromptCode;
    constructor(signatures: Signatures, guards: Guards);
    registerUI(onPromptCode: PromptCodeHandler): () => void;
    unregisterUI(): void;
    onStatusChange(cb: () => void): () => void;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
export {};
//# sourceMappingURL=guard.d.ts.map
import { Address, Hex } from 'ox';
import { Handler } from './handler.js';
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable } from '../types/index.js';
import { Signatures } from '../signatures.js';
import { Guards } from '../guards.js';
export declare class GuardHandler implements Handler {
    private readonly signatures;
    private readonly guards;
    kind: "guard-extension";
    private onPromptCode;
    constructor(signatures: Signatures, guards: Guards);
    registerUI(onPromptCode: (codeType: 'TOTP' | 'PIN', respond: (code: string) => Promise<void>) => Promise<void>): () => void;
    unregisterUI(): void;
    onStatusChange(cb: () => void): () => void;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
//# sourceMappingURL=guard.d.ts.map
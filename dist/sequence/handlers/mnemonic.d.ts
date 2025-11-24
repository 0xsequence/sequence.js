import { Signers } from '@0xsequence/wallet-core';
import { Address, Hex } from 'ox';
import { Handler } from './handler.js';
import { Signatures } from '../signatures.js';
import { SignerReady, SignerUnavailable, BaseSignatureRequest, SignerActionable } from '../types/index.js';
type RespondFn = (mnemonic: string) => Promise<void>;
export type PromptMnemonicHandler = (respond: RespondFn) => Promise<void>;
export declare class MnemonicHandler implements Handler {
    private readonly signatures;
    kind: "login-mnemonic";
    private onPromptMnemonic;
    private readySigners;
    constructor(signatures: Signatures);
    registerUI(onPromptMnemonic: PromptMnemonicHandler): () => void;
    unregisterUI(): void;
    addReadySigner(signer: Signers.Pk.Pk): void;
    onStatusChange(_cb: () => void): () => void;
    static toSigner(mnemonic: string): Signers.Pk.Pk | undefined;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
export {};
//# sourceMappingURL=mnemonic.d.ts.map
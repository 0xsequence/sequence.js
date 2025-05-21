import { Signers } from '@0xsequence/wallet-core';
import { Address, Hex } from 'ox';
import { Handler } from './handler.js';
import { Signatures } from '../signatures.js';
import { SignerUnavailable, BaseSignatureRequest, SignerActionable } from '../types/index.js';
type RespondFn = (mnemonic: string) => Promise<void>;
export declare class MnemonicHandler implements Handler {
    private readonly signatures;
    kind: "login-mnemonic";
    private onPromptMnemonic;
    constructor(signatures: Signatures);
    registerUI(onPromptMnemonic: (respond: RespondFn) => Promise<void>): () => void;
    unregisterUI(): void;
    onStatusChange(_cb: () => void): () => void;
    static toSigner(mnemonic: string): Signers.Pk.Pk | undefined;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerActionable>;
}
export {};
//# sourceMappingURL=mnemonic.d.ts.map
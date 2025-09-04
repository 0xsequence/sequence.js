import { Address, Hex } from 'ox';
import { Signers } from '@0xsequence/wallet-core';
import { Handler } from './handler.js';
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable } from '../types/index.js';
import { Signatures } from '../signatures.js';
export declare class GuardHandler implements Handler {
    private readonly signatures;
    private readonly guard;
    kind: "guard-extension";
    constructor(signatures: Signatures, guard: Signers.Guard);
    onStatusChange(cb: () => void): () => void;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
//# sourceMappingURL=guard.d.ts.map
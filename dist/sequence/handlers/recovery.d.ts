import { Address } from 'ox/Address';
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable } from '../types/index.js';
import { Handler } from './handler.js';
import { Recovery } from '../recovery.js';
import { Hex } from 'ox';
import { Signatures } from '../signatures.js';
export declare class RecoveryHandler implements Handler {
    private readonly signatures;
    readonly recovery: Recovery;
    kind: "recovery-extension";
    constructor(signatures: Signatures, recovery: Recovery);
    onStatusChange(cb: () => void): () => void;
    status(address: Address, imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
//# sourceMappingURL=recovery.d.ts.map
import { Address, Hex } from 'ox';
import { SignerActionable, SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types/index.js';
export interface Handler {
    kind: string;
    onStatusChange(cb: () => void): () => void;
    status(address: Address.Address, imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady | SignerActionable>;
}
//# sourceMappingURL=handler.d.ts.map
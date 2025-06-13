import { Envelope } from '@0xsequence/wallet-core';
import { Shared } from './manager.js';
import { Action, ActionToPayload, BaseSignatureRequest, SignatureRequest } from './types/signature-request.js';
export declare class Signatures {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    private getBase;
    list(): Promise<SignatureRequest[]>;
    get(requestId: string): Promise<SignatureRequest>;
    onSignatureRequestUpdate(requestId: string, cb: (requests: SignatureRequest) => void, onError?: (error: Error) => void, trigger?: boolean): () => void;
    onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean): () => void;
    complete(requestId: string): Promise<void>;
    request<A extends Action>(envelope: Envelope.Envelope<ActionToPayload[A]>, action: A, options?: {
        origin?: string;
    }): Promise<string>;
    addSignature(requestId: string, signature: Envelope.SapientSignature | Envelope.Signature): Promise<void>;
    cancel(requestId: string): Promise<void>;
    prune(): Promise<number>;
}
//# sourceMappingURL=signatures.d.ts.map
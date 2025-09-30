import { Envelope } from '@0xsequence/wallet-core';
import { Shared } from './manager.js';
import { Action, ActionToPayload, BaseSignatureRequest, SignatureRequest } from './types/signature-request.js';
export interface SignaturesInterface {
    /**
     * Retrieves the detailed state of a specific signature request.
     *
     * This method returns a "fully hydrated" `SignatureRequest` object. It contains not only the
     * static data about the request (like the wallet, action, and payload) but also a dynamic,
     * up-to-the-moment list of all required signers and their current statuses (`ready`, `actionable`,
     * `signed`, `unavailable`). This is the primary method to use when you need to display an
     * interactive signing prompt to the user.
     *
     * @param requestId The unique identifier of the signature request to retrieve.
     * @returns A promise that resolves to the detailed `SignatureRequest` object.
     * @throws An error if the request is not found or if it has expired and been pruned from the database.
     * @see {SignatureRequest} for the detailed structure of the returned object.
     */
    get(requestId: string): Promise<SignatureRequest>;
    /**
     * Returns a list of all signature requests across all wallets managed by this instance.
     *
     * This method is useful for displaying an overview of all pending and historical actions.
     * The returned objects are the `SignatureRequest` type but may not be as "live" as the object from `get()`.
     * For displaying an interactive UI for a specific request, it's recommended to use `get(requestId)`
     * or subscribe via `onSignatureRequestUpdate` to get the most detailed and real-time state.
     *
     * @returns A promise that resolves to an array of `BaseSignatureRequest` objects.
     */
    list(): Promise<BaseSignatureRequest[]>;
    /**
     * Cancel a specific signature request.
     *
     * @param requestId The ID of the request to cancel
     */
    cancel(requestId: string): Promise<void>;
    /**
     * Subscribes to real-time updates for a single, specific signature request.
     *
     * The provided callback is invoked whenever the state of the request changes. This is a powerful
     * feature for building reactive UIs, as the callback fires not only when the request's database
     * entry is updated (e.g., a signature is added) but also when the availability of its required
     * signers changes (e.g., an auth session expires).
     *
     * @param requestId The ID of the signature request to monitor.
     * @param cb The callback function to execute with the updated `SignatureRequest` object.
     * @param onError (Optional) A callback to handle errors that may occur during the update,
     *   such as the request being deleted or expiring.
     * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current
     *   state of the request upon registration.
     * @returns A function that, when called, will unsubscribe the listener and stop updates.
     */
    onSignatureRequestUpdate(requestId: string, cb: (request: SignatureRequest) => void, onError?: (error: Error) => void, trigger?: boolean): () => void;
    /**
     * Subscribes to updates on the list of all signature requests.
     *
     * The callback is fired whenever a signature request is created, updated (e.g., its status
     * changes to 'completed' or 'cancelled'), or removed. This is ideal for keeping a list
     * view of all signature requests synchronized.
     *
     * The callback receives an array of `BaseSignatureRequest` objects, which contain the core,
     * static data for each request.
     *
     * @param cb The callback function to execute with the updated list of `BaseSignatureRequest` objects.
     * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current
     *   list of requests upon registration.
     * @returns A function that, when called, will unsubscribe the listener.
     */
    onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean): () => void;
    /**
     * Listen for a specific terminal status on a signature request.
     *
     * This provides a targeted way to handle request completion or cancellation and automatically
     * disposes the listener when any terminal state is reached.
     *
     * @param status The terminal status to listen for ('completed' or 'cancelled').
     * @param requestId The ID of the signature request to monitor.
     * @param callback Function to execute when the status is reached.
     * @returns A function that, when called, will unsubscribe the listener.
     *
     * The listener automatically disposes after any terminal state is reached,
     * ensuring no memory leaks from one-time status listeners.
     *
     * @example
     * ```typescript
     * // Listen for completion (auto-disposes when resolved)
     * signatures.onSignatureRequestStatus('completed', requestId, (request) => {
     *   console.log('Request completed!', request)
     * })
     *
     * // Listen for cancellation (auto-disposes when resolved)
     * signatures.onSignatureRequestStatus('cancelled', requestId, (request) => {
     *   console.log('Request cancelled')
     * })
     * ```
     */
    onSignatureRequestStatus(status: 'completed' | 'cancelled', requestId: string, callback: (request: SignatureRequest) => void): () => void;
    /**
     * Convenience: listen for completion of a specific request.
     * Disposes automatically when the request resolves (completed or cancelled).
     */
    onComplete(requestId: string, callback: (request: SignatureRequest) => void): () => void;
    /**
     * Convenience: listen for cancellation of a specific request.
     * Disposes automatically when the request resolves (completed or cancelled).
     */
    onCancel(requestId: string, callback: (request: SignatureRequest) => void): () => void;
}
export declare class Signatures implements SignaturesInterface {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    private getBase;
    list(): Promise<BaseSignatureRequest[]>;
    get(requestId: string): Promise<SignatureRequest>;
    onSignatureRequestUpdate(requestId: string, cb: (requests: SignatureRequest) => void, onError?: (error: Error) => void, trigger?: boolean): () => void;
    onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean): () => void;
    onSignatureRequestStatus(status: 'completed' | 'cancelled', requestId: string, callback: (request: SignatureRequest) => void): () => void;
    onComplete(requestId: string, callback: (request: SignatureRequest) => void): () => void;
    onCancel(requestId: string, callback: (request: SignatureRequest) => void): () => void;
    complete(requestId: string): Promise<void>;
    request<A extends Action>(envelope: Envelope.Envelope<ActionToPayload[A]>, action: A, options?: {
        origin?: string;
    }): Promise<string>;
    addSignature(requestId: string, signature: Envelope.SapientSignature | Envelope.Signature): Promise<void>;
    cancel(requestId: string): Promise<void>;
    prune(): Promise<number>;
}
//# sourceMappingURL=signatures.d.ts.map
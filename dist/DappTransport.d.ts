import { PopupModeOptions, SendRequestOptions, SequenceSessionStorage, TransportMode } from './types/index.js';
export declare class DappTransport {
    readonly walletUrl: string;
    readonly mode: TransportMode;
    private walletWindow;
    private connectionState;
    private readyPromise;
    private readyPromiseResolve;
    private readyPromiseReject;
    private initId;
    private handshakeTimeoutId;
    private closeCheckIntervalId;
    private sessionId;
    private pendingRequests;
    private messageQueue;
    private readonly requestTimeoutMs;
    private readonly handshakeTimeoutMs;
    private readonly sequenceSessionStorage;
    private readonly redirectActionHandler?;
    private readonly isBrowser;
    readonly walletOrigin: string;
    constructor(walletUrl: string, mode?: TransportMode, popupModeOptions?: PopupModeOptions, sequenceSessionStorage?: SequenceSessionStorage, redirectActionHandler?: (url: string) => void);
    get isWalletOpen(): boolean;
    get isReady(): boolean;
    sendRequest<TResponse = any, TRequest = any>(action: string, redirectUrl: string, payload?: TRequest, options?: SendRequestOptions): Promise<TResponse>;
    getRequestRedirectUrl(action: string, payload: any, redirectUrl: string, path?: string): Promise<string>;
    getRedirectResponse<TResponse = any>(cleanState?: boolean, url?: string): Promise<{
        payload: TResponse;
        action: string;
    } | {
        error: any;
        action: string;
    } | null>;
    openWallet(path?: string): Promise<void>;
    closeWallet(): void;
    destroy(): void;
    private handleMessage;
    private handleWalletReadyMessage;
    private handleResponseMessage;
    private postMessageToWallet;
    private _resetConnection;
    private _handlePreConnectionFailure;
    private _handleDetectedClosure;
    private clearPendingRequests;
    private clearTimeouts;
    private generateId;
}
//# sourceMappingURL=DappTransport.d.ts.map
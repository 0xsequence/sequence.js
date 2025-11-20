export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.25.3;gen-typescript@v0.17.0;sequence-guard@v0.5.0";
export declare const WebRPCVersion = "v1";
export declare const WebRPCSchemaVersion = "v0.5.0";
export declare const WebRPCSchemaHash = "910e01c32ffb24b42386d4ca6be119b0acc55c5f";
type WebrpcGenVersions = {
    webrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export declare enum PayloadType {
    Calls = "Calls",
    Message = "Message",
    ConfigUpdate = "ConfigUpdate",
    SessionImplicitAuthorize = "SessionImplicitAuthorize"
}
export declare enum SignatureType {
    Hash = "Hash",
    Sapient = "Sapient",
    EthSign = "EthSign",
    Erc1271 = "Erc1271"
}
export interface Version {
    webrpcVersion: string;
    schemaVersion: string;
    schemaHash: string;
    appVersion: string;
}
export interface RuntimeStatus {
    healthOK: boolean;
    startTime: string;
    uptime: number;
    ver: string;
    branch: string;
    commitHash: string;
}
export interface WalletConfig {
    address: string;
    content: string;
}
export interface WalletSigner {
    address: string;
    weight: number;
}
export interface SignRequest {
    chainId: number;
    msg: string;
    auxData?: string;
    wallet?: string;
    payloadType?: PayloadType;
    payloadData?: string;
    signatures?: Array<Signature>;
}
export interface OwnershipProof {
    wallet: string;
    timestamp: number;
    signer: string;
    signature: string;
    chainId: number;
}
export interface AuthToken {
    id: string;
    token: string;
    resetAuth?: boolean;
}
export interface RecoveryCode {
    code: string;
    used: boolean;
}
export interface Signature {
    address: string;
    type: SignatureType;
    imageHash?: string;
    data: string;
}
export interface Guard {
    ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>;
    version(headers?: object, signal?: AbortSignal): Promise<VersionReturn>;
    runtimeStatus(headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn>;
    getSignerConfig(args: GetSignerConfigArgs, headers?: object, signal?: AbortSignal): Promise<GetSignerConfigReturn>;
    /**
     * Called by sequence.app when the user signs in, and signs messages/transactions/migrations.
     * Requires a valid 2FA token if enabled.
     */
    sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>;
    signWith(args: SignWithArgs, headers?: object, signal?: AbortSignal): Promise<SignWithReturn>;
    /**
     * Internal use only.
     * Only ever needs to be called once per chain.
     * Signs a preconfigured payload that the caller has no control over.
     */
    patch(args: PatchArgs, headers?: object, signal?: AbortSignal): Promise<PatchReturn>;
    /**
     * Called by sequence.app when it needs to check the user's 2FA.
     * This happens during sign in, before signing messages and transactions, and when configuring 2FA.
     * Requires either a valid JWT or a signature by one of the wallet's signers.
     */
    authMethods(args: AuthMethodsArgs, headers?: object, signal?: AbortSignal): Promise<AuthMethodsReturn>;
    /**
     * Not currently called. Requires both a JWT and a wallet signature.
     */
    setPIN(args: SetPINArgs, headers?: object, signal?: AbortSignal): Promise<SetPINReturn>;
    /**
     * Not currently called. Requires both a JWT and a wallet signature.
     */
    resetPIN(args: ResetPINArgs, headers?: object, signal?: AbortSignal): Promise<ResetPINReturn>;
    /**
     * Called by sequence.app when the user configures their 2FA.
     * Requires both a JWT and a wallet signature.
     */
    createTOTP(args: CreateTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CreateTOTPReturn>;
    /**
     * Called by sequence.app when the user configures their 2FA.
     * Requires both a JWT and a wallet signature.
     */
    commitTOTP(args: CommitTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CommitTOTPReturn>;
    /**
     * Called by sequence.app when the user configures their 2FA.
     * Requires both a JWT and a wallet signature.
     */
    resetTOTP(args: ResetTOTPArgs, headers?: object, signal?: AbortSignal): Promise<ResetTOTPReturn>;
    /**
     * Called by sequence.app when the user uses a recovery code.
     * Requires either a valid JWT or a signature by one of the wallet's signers.
     */
    reset2FA(args: Reset2FAArgs, headers?: object, signal?: AbortSignal): Promise<Reset2FAReturn>;
    /**
     * Called by sequence.app when the user is viewing their recovery codes.
     * Requires both a JWT and a wallet signature.
     */
    recoveryCodes(args: RecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<RecoveryCodesReturn>;
    /**
     * Called by sequence.app when the user is viewing their recovery codes.
     * Requires both a JWT and a wallet signature.
     */
    resetRecoveryCodes(args: ResetRecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<ResetRecoveryCodesReturn>;
}
export interface PingArgs {
}
export interface PingReturn {
    status: boolean;
}
export interface VersionArgs {
}
export interface VersionReturn {
    version: Version;
}
export interface RuntimeStatusArgs {
}
export interface RuntimeStatusReturn {
    status: RuntimeStatus;
}
export interface GetSignerConfigArgs {
    signer: string;
}
export interface GetSignerConfigReturn {
    signerConfig: WalletConfig;
}
export interface SignArgs {
    request: SignRequest;
    token?: AuthToken;
}
export interface SignReturn {
    sig: string;
}
export interface SignWithArgs {
    signer: string;
    request: SignRequest;
    token?: AuthToken;
}
export interface SignWithReturn {
    sig: string;
}
export interface PatchArgs {
    signer: string;
    chainId: number;
    secret: string;
}
export interface PatchReturn {
    txs: any;
}
export interface AuthMethodsArgs {
    proof?: OwnershipProof;
}
export interface AuthMethodsReturn {
    methods: Array<string>;
    active: boolean;
}
export interface SetPINArgs {
    pin: string;
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface SetPINReturn {
}
export interface ResetPINArgs {
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface ResetPINReturn {
}
export interface CreateTOTPArgs {
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface CreateTOTPReturn {
    uri: string;
}
export interface CommitTOTPArgs {
    token: string;
}
export interface CommitTOTPReturn {
    codes: Array<RecoveryCode>;
}
export interface ResetTOTPArgs {
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface ResetTOTPReturn {
}
export interface Reset2FAArgs {
    code: string;
    proof?: OwnershipProof;
}
export interface Reset2FAReturn {
}
export interface RecoveryCodesArgs {
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface RecoveryCodesReturn {
    codes: Array<RecoveryCode>;
}
export interface ResetRecoveryCodesArgs {
    timestamp: number;
    signature: string;
    chainId: number;
}
export interface ResetRecoveryCodesReturn {
    codes: Array<RecoveryCode>;
}
export declare class Guard implements Guard {
    protected hostname: string;
    protected fetch: Fetch;
    protected path: string;
    constructor(hostname: string, fetch: Fetch);
    private url;
    ping: (headers?: object, signal?: AbortSignal) => Promise<PingReturn>;
    version: (headers?: object, signal?: AbortSignal) => Promise<VersionReturn>;
    runtimeStatus: (headers?: object, signal?: AbortSignal) => Promise<RuntimeStatusReturn>;
    getSignerConfig: (args: GetSignerConfigArgs, headers?: object, signal?: AbortSignal) => Promise<GetSignerConfigReturn>;
    sign: (args: SignArgs, headers?: object, signal?: AbortSignal) => Promise<SignReturn>;
    signWith: (args: SignWithArgs, headers?: object, signal?: AbortSignal) => Promise<SignWithReturn>;
    patch: (args: PatchArgs, headers?: object, signal?: AbortSignal) => Promise<PatchReturn>;
    authMethods: (args: AuthMethodsArgs, headers?: object, signal?: AbortSignal) => Promise<AuthMethodsReturn>;
    setPIN: (args: SetPINArgs, headers?: object, signal?: AbortSignal) => Promise<SetPINReturn>;
    resetPIN: (args: ResetPINArgs, headers?: object, signal?: AbortSignal) => Promise<ResetPINReturn>;
    createTOTP: (args: CreateTOTPArgs, headers?: object, signal?: AbortSignal) => Promise<CreateTOTPReturn>;
    commitTOTP: (args: CommitTOTPArgs, headers?: object, signal?: AbortSignal) => Promise<CommitTOTPReturn>;
    resetTOTP: (args: ResetTOTPArgs, headers?: object, signal?: AbortSignal) => Promise<ResetTOTPReturn>;
    reset2FA: (args: Reset2FAArgs, headers?: object, signal?: AbortSignal) => Promise<Reset2FAReturn>;
    recoveryCodes: (args: RecoveryCodesArgs, headers?: object, signal?: AbortSignal) => Promise<RecoveryCodesReturn>;
    resetRecoveryCodes: (args: ResetRecoveryCodesArgs, headers?: object, signal?: AbortSignal) => Promise<ResetRecoveryCodesReturn>;
}
export declare class WebrpcError extends Error {
    name: string;
    code: number;
    message: string;
    status: number;
    cause?: string;
    /** @deprecated Use message instead of msg. Deprecated in webrpc v0.11.0. */
    msg: string;
    constructor(name: string, code: number, message: string, status: number, cause?: string);
    static new(payload: any): WebrpcError;
}
export declare class WebrpcEndpointError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcRequestFailedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcBadRouteError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcBadMethodError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcBadRequestError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcBadResponseError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcServerPanicError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcInternalErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcClientDisconnectedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcStreamLostError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class WebrpcStreamFinishedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class UnauthorizedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class PermissionDeniedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class SessionExpiredError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class MethodNotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class RequestConflictError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AbortedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class GeoblockedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class RateLimitedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InvalidArgumentError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class UnavailableError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class QueryFailedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class ValidationFailedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class NotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class RequiresTOTPError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class RequiresPINError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare enum errors {
    WebrpcEndpoint = "WebrpcEndpoint",
    WebrpcRequestFailed = "WebrpcRequestFailed",
    WebrpcBadRoute = "WebrpcBadRoute",
    WebrpcBadMethod = "WebrpcBadMethod",
    WebrpcBadRequest = "WebrpcBadRequest",
    WebrpcBadResponse = "WebrpcBadResponse",
    WebrpcServerPanic = "WebrpcServerPanic",
    WebrpcInternalError = "WebrpcInternalError",
    WebrpcClientDisconnected = "WebrpcClientDisconnected",
    WebrpcStreamLost = "WebrpcStreamLost",
    WebrpcStreamFinished = "WebrpcStreamFinished",
    Unauthorized = "Unauthorized",
    PermissionDenied = "PermissionDenied",
    SessionExpired = "SessionExpired",
    MethodNotFound = "MethodNotFound",
    RequestConflict = "RequestConflict",
    Aborted = "Aborted",
    Geoblocked = "Geoblocked",
    RateLimited = "RateLimited",
    InvalidArgument = "InvalidArgument",
    Unavailable = "Unavailable",
    QueryFailed = "QueryFailed",
    ValidationFailed = "ValidationFailed",
    NotFound = "NotFound",
    RequiresTOTP = "RequiresTOTP",
    RequiresPIN = "RequiresPIN"
}
export declare enum WebrpcErrorCodes {
    WebrpcEndpoint = 0,
    WebrpcRequestFailed = -1,
    WebrpcBadRoute = -2,
    WebrpcBadMethod = -3,
    WebrpcBadRequest = -4,
    WebrpcBadResponse = -5,
    WebrpcServerPanic = -6,
    WebrpcInternalError = -7,
    WebrpcClientDisconnected = -8,
    WebrpcStreamLost = -9,
    WebrpcStreamFinished = -10,
    Unauthorized = 1000,
    PermissionDenied = 1001,
    SessionExpired = 1002,
    MethodNotFound = 1003,
    RequestConflict = 1004,
    Aborted = 1005,
    Geoblocked = 1006,
    RateLimited = 1007,
    InvalidArgument = 2001,
    Unavailable = 2002,
    QueryFailed = 2003,
    ValidationFailed = 2004,
    NotFound = 3000,
    RequiresTOTP = 6600,
    RequiresPIN = 6601
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export {};
//# sourceMappingURL=guard.gen.d.ts.map
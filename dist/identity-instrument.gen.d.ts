export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.23.1;gen-typescript@v0.16.3;identity-instrument@v0.1.0";
export declare const WebRPCVersion = "v1";
export declare const WebRPCSchemaVersion = "v0.1.0";
export declare const WebRPCSchemaHash = "2338b17497d46b1813768be23a7338716a4b6d9f";
type WebrpcGenVersions = {
    webrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export declare enum KeyType {
    P256K1 = "P256K1",
    P256R1 = "P256R1"
}
export declare enum IdentityType {
    Guest = "Guest",
    Email = "Email",
    OIDC = "OIDC"
}
export declare enum AuthMode {
    Guest = "Guest",
    OTP = "OTP",
    IDToken = "IDToken",
    AccessToken = "AccessToken",
    AuthCode = "AuthCode",
    AuthCodePKCE = "AuthCodePKCE"
}
export interface CommitVerifierParams {
    authKey: AuthKey;
    identityType: IdentityType;
    authMode: AuthMode;
    metadata: {
        [key: string]: string;
    };
    handle?: string;
    signer?: string;
}
export interface CompleteAuthParams {
    authKey: AuthKey;
    identityType: IdentityType;
    authMode: AuthMode;
    verifier: string;
    answer: string;
}
export interface SignParams {
    signer: string;
    digest: string;
    authKey: AuthKey;
    signature: string;
}
export interface Identity {
    type: IdentityType;
    issuer: string;
    subject: string;
    email: string;
}
export interface AuthID {
    ecosystem: string;
    authMode: AuthMode;
    identityType: IdentityType;
    verifier: string;
}
export interface AuthKey {
    publicKey: string;
    keyType: KeyType;
}
export interface AuthKeyData {
    ecosystem: string;
    signerAddress: string;
    publicKey: string;
    keyType: KeyType;
    expiry: string;
}
export interface SignerData {
    ecosystem: string;
    identity: Identity;
    keyType: KeyType;
    privateKey: string;
}
export interface AuthCommitmentData {
    ecosystem: string;
    authKey: AuthKey;
    authMode: AuthMode;
    identityType: IdentityType;
    handle: string;
    signer: string;
    challenge: string;
    answer: string;
    metadata: {
        [key: string]: string;
    };
    expiry: string;
}
export interface IdentityInstrument {
    commitVerifier(args: CommitVerifierArgs, headers?: object, signal?: AbortSignal): Promise<CommitVerifierReturn>;
    completeAuth(args: CompleteAuthArgs, headers?: object, signal?: AbortSignal): Promise<CompleteAuthReturn>;
    sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>;
}
export interface CommitVerifierArgs {
    params: CommitVerifierParams;
}
export interface CommitVerifierReturn {
    verifier: string;
    loginHint: string;
    challenge: string;
}
export interface CompleteAuthArgs {
    params: CompleteAuthParams;
}
export interface CompleteAuthReturn {
    signer: string;
}
export interface SignArgs {
    params: SignParams;
}
export interface SignReturn {
    signature: string;
}
export declare class IdentityInstrument implements IdentityInstrument {
    protected hostname: string;
    protected fetch: Fetch;
    protected path: string;
    constructor(hostname: string, fetch: Fetch);
    private url;
    commitVerifier: (args: CommitVerifierArgs, headers?: object, signal?: AbortSignal) => Promise<CommitVerifierReturn>;
    completeAuth: (args: CompleteAuthArgs, headers?: object, signal?: AbortSignal) => Promise<CompleteAuthReturn>;
    sign: (args: SignArgs, headers?: object, signal?: AbortSignal) => Promise<SignReturn>;
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
    WebrpcStreamFinished = "WebrpcStreamFinished"
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
    WebrpcStreamFinished = -10
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export {};
//# sourceMappingURL=identity-instrument.gen.d.ts.map
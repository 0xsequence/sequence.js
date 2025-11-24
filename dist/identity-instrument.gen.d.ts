export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.23.1;gen-typescript@v0.16.3;identity-instrument@v0.1.0";
export declare const WebRPCVersion = "v1";
export declare const WebRPCSchemaVersion = "v0.1.0";
export declare const WebRPCSchemaHash = "b0ca08fbbd2e98d269d745176d4de5cbfa8960d6";
type WebrpcGenVersions = {
    webrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export declare enum KeyType {
    WebCrypto_Secp256r1 = "WebCrypto_Secp256r1",
    Ethereum_Secp256k1 = "Ethereum_Secp256k1"
}
export declare enum IdentityType {
    Email = "Email",
    OIDC = "OIDC"
}
export declare enum AuthMode {
    OTP = "OTP",
    IDToken = "IDToken",
    AccessToken = "AccessToken",
    AuthCode = "AuthCode",
    AuthCodePKCE = "AuthCodePKCE"
}
export interface CommitVerifierParams {
    scope?: string;
    identityType: IdentityType;
    authMode: AuthMode;
    metadata: {
        [key: string]: string;
    };
    handle?: string;
    signer?: Key;
}
export interface CompleteAuthParams {
    scope?: string;
    identityType: IdentityType;
    signerType: KeyType;
    authMode: AuthMode;
    verifier: string;
    answer: string;
    lifetime?: number;
}
export interface SignParams {
    scope?: string;
    signer: Key;
    nonce: string;
    digest: string;
}
export interface Identity {
    type: IdentityType;
    issuer: string;
    subject: string;
    email: string;
}
export interface Key {
    keyType: KeyType;
    address: string;
}
export interface AuthID {
    scope: string;
    authMode: AuthMode;
    identityType: IdentityType;
    verifier: string;
}
export interface AuthKeyData {
    scope: string;
    authKey: string;
    signer: string;
    expiry: string;
}
export interface SignerData {
    scope: string;
    identity: Identity;
    keyType: KeyType;
    privateKey: string;
}
export interface AuthCommitmentData {
    scope: string;
    authKey: string;
    authMode: AuthMode;
    identityType: IdentityType;
    handle: string;
    signer: string;
    challenge: string;
    answer: string;
    metadata: {
        [key: string]: string;
    };
    attempts: number;
    expiry: string;
}
export interface IdentityInstrument {
    commitVerifier(args: CommitVerifierArgs, headers?: object, signal?: AbortSignal): Promise<CommitVerifierReturn>;
    completeAuth(args: CompleteAuthArgs, headers?: object, signal?: AbortSignal): Promise<CompleteAuthReturn>;
    sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>;
}
export interface CommitVerifierArgs {
    params: CommitVerifierParams;
    authKey: Key;
    signature: string;
}
export interface CommitVerifierReturn {
    verifier: string;
    loginHint: string;
    challenge: string;
}
export interface CompleteAuthArgs {
    params: CompleteAuthParams;
    authKey: Key;
    signature: string;
}
export interface CompleteAuthReturn {
    signer: Key;
    identity: Identity;
}
export interface SignArgs {
    params: SignParams;
    authKey: Key;
    signature: string;
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
export declare class InternalErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class EncryptionErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class DatabaseErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class DataIntegrityErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class IdentityProviderErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InvalidRequestError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InvalidSignatureError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class KeyNotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class KeyExpiredError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class SignerNotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class ProofVerificationFailedError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AnswerIncorrectError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class ChallengeExpiredError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class TooManyAttemptsError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class OAuthErrorError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AccessErrorError extends WebrpcError {
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
    InternalError = "InternalError",
    EncryptionError = "EncryptionError",
    DatabaseError = "DatabaseError",
    DataIntegrityError = "DataIntegrityError",
    IdentityProviderError = "IdentityProviderError",
    InvalidRequest = "InvalidRequest",
    InvalidSignature = "InvalidSignature",
    KeyNotFound = "KeyNotFound",
    KeyExpired = "KeyExpired",
    SignerNotFound = "SignerNotFound",
    ProofVerificationFailed = "ProofVerificationFailed",
    AnswerIncorrect = "AnswerIncorrect",
    ChallengeExpired = "ChallengeExpired",
    TooManyAttempts = "TooManyAttempts",
    OAuthError = "OAuthError",
    AccessError = "AccessError"
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
    InternalError = 7100,
    EncryptionError = 7101,
    DatabaseError = 7102,
    DataIntegrityError = 7103,
    IdentityProviderError = 7104,
    InvalidRequest = 7200,
    InvalidSignature = 7201,
    KeyNotFound = 7202,
    KeyExpired = 7203,
    SignerNotFound = 7204,
    ProofVerificationFailed = 7002,
    AnswerIncorrect = 7003,
    ChallengeExpired = 7004,
    TooManyAttempts = 7005,
    OAuthError = 7006,
    AccessError = 7007
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export {};
//# sourceMappingURL=identity-instrument.gen.d.ts.map
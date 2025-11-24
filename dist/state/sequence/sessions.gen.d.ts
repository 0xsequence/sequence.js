export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.22.1;gen-typescript@v0.16.2;sessions@v0.0.1";
export declare const WebRPCVersion = "v1";
export declare const WebRPCSchemaVersion = "v0.0.1";
export declare const WebRPCSchemaHash = "7f7ab1f70cc9f789cfe5317c9378f0c66895f141";
type WebrpcGenVersions = {
    webrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export declare enum PayloadType {
    Transactions = "Transactions",
    Message = "Message",
    ConfigUpdate = "ConfigUpdate",
    Digest = "Digest"
}
export declare enum SignatureType {
    EIP712 = "EIP712",
    EthSign = "EthSign",
    EIP1271 = "EIP1271",
    Sapient = "Sapient",
    SapientCompact = "SapientCompact"
}
export interface RuntimeStatus {
    healthy: boolean;
    started: string;
    uptime: number;
    version: string;
    branch: string;
    commit: string;
    arweave: ArweaveStatus;
}
export interface ArweaveStatus {
    nodeURL: string;
    namespace: string;
    sender: string;
    signer: string;
    flushInterval: string;
    bundleDelay: string;
    bundleLimit: number;
    confirmations: number;
    lockTTL: string;
    healthy: boolean;
    lastFlush?: string;
    lastFlushSeconds?: number;
}
export interface Info {
    wallets: {
        [key: string]: number;
    };
    configs: {
        [key: string]: number;
    };
    configTrees: number;
    trees: number;
    migrations: {
        [key: string]: number;
    };
    signatures: number;
    sapientSignatures: number;
    digests: number;
    payloads: number;
    recorder: RecorderInfo;
    arweave: ArweaveInfo;
}
export interface RecorderInfo {
    requests: number;
    buffer: number;
    lastFlush?: string;
    lastFlushSeconds?: number;
    endpoints: {
        [key: string]: number;
    };
}
export interface ArweaveInfo {
    nodeURL: string;
    namespace: string;
    sender: ArweaveSenderInfo;
    signer: string;
    flushInterval: string;
    bundleDelay: string;
    bundleLimit: number;
    confirmations: number;
    lockTTL: string;
    healthy: boolean;
    lastFlush?: string;
    lastFlushSeconds?: number;
    bundles: number;
    pending: ArweavePendingInfo;
}
export interface ArweaveSenderInfo {
    address: string;
    balance: string;
}
export interface ArweavePendingInfo {
    wallets: number;
    configs: number;
    trees: number;
    migrations: number;
    signatures: number;
    sapientSignatures: number;
    payloads: number;
    bundles: Array<ArweaveBundleInfo>;
}
export interface ArweaveBundleInfo {
    transaction: string;
    block: number;
    items: number;
    sentAt: string;
    confirmations: number;
}
export interface Context {
    version: number;
    factory: string;
    mainModule: string;
    mainModuleUpgradable: string;
    guestModule: string;
    walletCreationCode: string;
}
export interface Signature {
    digest?: string;
    payload?: any;
    toImageHash?: string;
    chainID: string;
    type: SignatureType;
    signature: string;
    sapientHash?: string;
    validOnChain?: string;
    validOnBlock?: string;
    validOnBlockHash?: string;
}
export interface SignerSignature {
    signer?: string;
    signature: string;
    referenceChainID?: string;
}
export interface SignerSignature2 {
    signer?: string;
    imageHash?: string;
    type: SignatureType;
    signature: string;
    referenceChainID?: string;
}
export interface ConfigUpdate {
    toImageHash: string;
    signature: string;
}
export interface Transaction {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    delegateCall?: boolean;
    revertOnError?: boolean;
}
export interface TransactionBundle {
    executor: string;
    transactions: Array<Transaction>;
    nonce: string;
    signature: string;
}
export interface Sessions {
    ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>;
    config(args: ConfigArgs, headers?: object, signal?: AbortSignal): Promise<ConfigReturn>;
    tree(args: TreeArgs, headers?: object, signal?: AbortSignal): Promise<TreeReturn>;
    payload(args: PayloadArgs, headers?: object, signal?: AbortSignal): Promise<PayloadReturn>;
    wallets(args: WalletsArgs, headers?: object, signal?: AbortSignal): Promise<WalletsReturn>;
    deployHash(args: DeployHashArgs, headers?: object, signal?: AbortSignal): Promise<DeployHashReturn>;
    witness(args: WitnessArgs, headers?: object, signal?: AbortSignal): Promise<WitnessReturn>;
    configUpdates(args: ConfigUpdatesArgs, headers?: object, signal?: AbortSignal): Promise<ConfigUpdatesReturn>;
    migrations(args: MigrationsArgs, headers?: object, signal?: AbortSignal): Promise<MigrationsReturn>;
    saveConfig(args: SaveConfigArgs, headers?: object, signal?: AbortSignal): Promise<SaveConfigReturn>;
    saveTree(args: SaveTreeArgs, headers?: object, signal?: AbortSignal): Promise<SaveTreeReturn>;
    savePayload(args: SavePayloadArgs, headers?: object, signal?: AbortSignal): Promise<SavePayloadReturn>;
    saveWallet(args: SaveWalletArgs, headers?: object, signal?: AbortSignal): Promise<SaveWalletReturn>;
    saveSignature(args: SaveSignatureArgs, headers?: object, signal?: AbortSignal): Promise<SaveSignatureReturn>;
    saveSignature2(args: SaveSignature2Args, headers?: object, signal?: AbortSignal): Promise<SaveSignature2Return>;
    saveSignerSignatures(args: SaveSignerSignaturesArgs, headers?: object, signal?: AbortSignal): Promise<SaveSignerSignaturesReturn>;
    saveSignerSignatures2(args: SaveSignerSignatures2Args, headers?: object, signal?: AbortSignal): Promise<SaveSignerSignatures2Return>;
    saveSignerSignatures3(args: SaveSignerSignatures3Args, headers?: object, signal?: AbortSignal): Promise<SaveSignerSignatures3Return>;
    saveMigration(args: SaveMigrationArgs, headers?: object, signal?: AbortSignal): Promise<SaveMigrationReturn>;
}
export interface PingArgs {
}
export interface PingReturn {
}
export interface ConfigArgs {
    imageHash: string;
}
export interface ConfigReturn {
    version: number;
    config: any;
}
export interface TreeArgs {
    imageHash: string;
}
export interface TreeReturn {
    version: number;
    tree: any;
}
export interface PayloadArgs {
    digest: string;
}
export interface PayloadReturn {
    version: number;
    payload: any;
    wallet: string;
    chainID: string;
}
export interface WalletsArgs {
    signer: string;
    sapientHash?: string;
    cursor?: number;
    limit?: number;
}
export interface WalletsReturn {
    wallets: {
        [key: string]: Signature;
    };
    cursor: number;
}
export interface DeployHashArgs {
    wallet: string;
}
export interface DeployHashReturn {
    deployHash: string;
    context: Context;
}
export interface WitnessArgs {
    signer: string;
    wallet: string;
    sapientHash?: string;
}
export interface WitnessReturn {
    witness: Signature;
}
export interface ConfigUpdatesArgs {
    wallet: string;
    fromImageHash: string;
    allUpdates?: boolean;
}
export interface ConfigUpdatesReturn {
    updates: Array<ConfigUpdate>;
}
export interface MigrationsArgs {
    wallet: string;
    fromVersion: number;
    fromImageHash: string;
    chainID?: string;
}
export interface MigrationsReturn {
    migrations: {
        [key: string]: {
            [key: number]: {
                [key: string]: TransactionBundle;
            };
        };
    };
}
export interface SaveConfigArgs {
    version: number;
    config: any;
}
export interface SaveConfigReturn {
}
export interface SaveTreeArgs {
    version: number;
    tree: any;
}
export interface SaveTreeReturn {
}
export interface SavePayloadArgs {
    version: number;
    payload: any;
    wallet: string;
    chainID: string;
}
export interface SavePayloadReturn {
}
export interface SaveWalletArgs {
    version: number;
    deployConfig: any;
    context?: Context;
}
export interface SaveWalletReturn {
}
export interface SaveSignatureArgs {
    wallet: string;
    digest: string;
    chainID: string;
    signature: string;
    toConfig?: any;
    referenceChainID?: string;
}
export interface SaveSignatureReturn {
}
export interface SaveSignature2Args {
    wallet: string;
    payload: any;
    chainID: string;
    signature: string;
    toConfig?: any;
    referenceChainID?: string;
}
export interface SaveSignature2Return {
}
export interface SaveSignerSignaturesArgs {
    wallet: string;
    digest: string;
    chainID: string;
    signatures: Array<string>;
    toConfig?: any;
}
export interface SaveSignerSignaturesReturn {
}
export interface SaveSignerSignatures2Args {
    wallet: string;
    digest: string;
    chainID: string;
    signatures: Array<SignerSignature>;
    toConfig?: any;
}
export interface SaveSignerSignatures2Return {
}
export interface SaveSignerSignatures3Args {
    wallet: string;
    payload: any;
    chainID: string;
    signatures: Array<SignerSignature2>;
    toConfig?: any;
}
export interface SaveSignerSignatures3Return {
}
export interface SaveMigrationArgs {
    wallet: string;
    fromVersion: number;
    toVersion: number;
    toConfig: any;
    executor: string;
    transactions: Array<Transaction>;
    nonce: string;
    signature: string;
    chainID?: string;
}
export interface SaveMigrationReturn {
}
export declare class Sessions implements Sessions {
    protected hostname: string;
    protected fetch: Fetch;
    protected path: string;
    constructor(hostname: string, fetch: Fetch);
    private url;
    ping: (headers?: object, signal?: AbortSignal) => Promise<PingReturn>;
    config: (args: ConfigArgs, headers?: object, signal?: AbortSignal) => Promise<ConfigReturn>;
    tree: (args: TreeArgs, headers?: object, signal?: AbortSignal) => Promise<TreeReturn>;
    payload: (args: PayloadArgs, headers?: object, signal?: AbortSignal) => Promise<PayloadReturn>;
    wallets: (args: WalletsArgs, headers?: object, signal?: AbortSignal) => Promise<WalletsReturn>;
    deployHash: (args: DeployHashArgs, headers?: object, signal?: AbortSignal) => Promise<DeployHashReturn>;
    witness: (args: WitnessArgs, headers?: object, signal?: AbortSignal) => Promise<WitnessReturn>;
    configUpdates: (args: ConfigUpdatesArgs, headers?: object, signal?: AbortSignal) => Promise<ConfigUpdatesReturn>;
    migrations: (args: MigrationsArgs, headers?: object, signal?: AbortSignal) => Promise<MigrationsReturn>;
    saveConfig: (args: SaveConfigArgs, headers?: object, signal?: AbortSignal) => Promise<SaveConfigReturn>;
    saveTree: (args: SaveTreeArgs, headers?: object, signal?: AbortSignal) => Promise<SaveTreeReturn>;
    savePayload: (args: SavePayloadArgs, headers?: object, signal?: AbortSignal) => Promise<SavePayloadReturn>;
    saveWallet: (args: SaveWalletArgs, headers?: object, signal?: AbortSignal) => Promise<SaveWalletReturn>;
    saveSignature: (args: SaveSignatureArgs, headers?: object, signal?: AbortSignal) => Promise<SaveSignatureReturn>;
    saveSignature2: (args: SaveSignature2Args, headers?: object, signal?: AbortSignal) => Promise<SaveSignature2Return>;
    saveSignerSignatures: (args: SaveSignerSignaturesArgs, headers?: object, signal?: AbortSignal) => Promise<SaveSignerSignaturesReturn>;
    saveSignerSignatures2: (args: SaveSignerSignatures2Args, headers?: object, signal?: AbortSignal) => Promise<SaveSignerSignatures2Return>;
    saveSignerSignatures3: (args: SaveSignerSignatures3Args, headers?: object, signal?: AbortSignal) => Promise<SaveSignerSignatures3Return>;
    saveMigration: (args: SaveMigrationArgs, headers?: object, signal?: AbortSignal) => Promise<SaveMigrationReturn>;
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
export declare class InvalidArgumentError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class NotFoundError extends WebrpcError {
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
    InvalidArgument = "InvalidArgument",
    NotFound = "NotFound"
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
    InvalidArgument = 1,
    NotFound = 2
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export {};
//# sourceMappingURL=sessions.gen.d.ts.map
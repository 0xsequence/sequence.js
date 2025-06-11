export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.24.0;gen-typescript@v0.16.3;sequence-relayer@v0.4.1";
export declare const WebRPCVersion = "v1";
export declare const WebRPCSchemaVersion = "v0.4.1";
export declare const WebRPCSchemaHash = "62dd019c839b6a47985cf41ce45822de8b3e4896";
type WebrpcGenVersions = {
    webrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export declare enum ETHTxnStatus {
    UNKNOWN = "UNKNOWN",
    DROPPED = "DROPPED",
    QUEUED = "QUEUED",
    SENT = "SENT",
    SUCCEEDED = "SUCCEEDED",
    PARTIALLY_FAILED = "PARTIALLY_FAILED",
    FAILED = "FAILED",
    PENDING_PRECONDITION = "PENDING_PRECONDITION"
}
export declare enum TransferType {
    SEND = "SEND",
    RECEIVE = "RECEIVE",
    BRIDGE_DEPOSIT = "BRIDGE_DEPOSIT",
    BRIDGE_WITHDRAW = "BRIDGE_WITHDRAW",
    BURN = "BURN",
    UNKNOWN = "UNKNOWN"
}
export declare enum FeeTokenType {
    UNKNOWN = "UNKNOWN",
    ERC20_TOKEN = "ERC20_TOKEN",
    ERC1155_TOKEN = "ERC1155_TOKEN"
}
export declare enum SortOrder {
    DESC = "DESC",
    ASC = "ASC"
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
    chainID: number;
    useEIP1559: boolean;
    senders: Array<SenderStatus>;
    checks: RuntimeChecks;
}
export interface SenderStatus {
    index: number;
    address: string;
    etherBalance: number;
    active: boolean;
}
export interface RuntimeChecks {
}
export interface SequenceContext {
    factory: string;
    mainModule: string;
    mainModuleUpgradable: string;
    guestModule: string;
    utils: string;
}
export interface GasTank {
    id: number;
    chainId: number;
    name: string;
    currentBalance: number;
    unlimited: boolean;
    feeMarkupFactor: number;
    updatedAt: string;
    createdAt: string;
}
export interface GasTankBalanceAdjustment {
    gasTankId: number;
    nonce: number;
    amount: number;
    totalBalance: number;
    balanceTimestamp: string;
    createdAt: string;
}
export interface GasSponsor {
    id: number;
    gasTankId: number;
    projectId: number;
    chainId: number;
    address: string;
    name: string;
    active: boolean;
    updatedAt: string;
    createdAt: string;
    deletedAt: string;
}
export interface GasSponsorUsage {
    name: string;
    id: number;
    totalGasUsed: number;
    totalTxnFees: number;
    totalTxnFeesUsd: number;
    avgGasPrice: number;
    totalTxns: number;
    startTime: string;
    endTime: string;
}
export interface MetaTxn {
    walletAddress: string;
    contract: string;
    input: string;
}
export interface MetaTxnLog {
    id: number;
    chainId: number;
    projectId: number;
    txnHash: string;
    txnNonce: string;
    metaTxnID?: string;
    txnStatus: ETHTxnStatus;
    txnRevertReason: string;
    requeues: number;
    queuedAt: string;
    sentAt: string;
    minedAt: string;
    target: string;
    input: string;
    txnArgs: {
        [key: string]: any;
    };
    txnReceipt?: {
        [key: string]: any;
    };
    walletAddress: string;
    metaTxnNonce: string;
    gasLimit: number;
    gasPrice: string;
    gasUsed: number;
    gasEstimated: number;
    gasFeeMarkup?: number;
    usdRate: string;
    creditsUsed: number;
    cost: string;
    isWhitelisted: boolean;
    gasSponsor?: number;
    gasTank?: number;
    updatedAt: string;
    createdAt: string;
}
export interface MetaTxnReceipt {
    id: string;
    status: string;
    revertReason?: string;
    index: number;
    logs: Array<MetaTxnReceiptLog>;
    receipts: Array<MetaTxnReceipt>;
    blockNumber: string;
    txnHash: string;
    txnReceipt: string;
}
export interface MetaTxnReceiptLog {
    address: string;
    topics: Array<string>;
    data: string;
}
export interface IntentPrecondition {
    type: string;
    chainId: string;
    data: any;
}
export interface IntentSolution {
    transactions: Array<Transactions>;
}
export interface Transactions {
    chainID: string;
    transactions: Array<Transaction>;
    preconditions?: Array<IntentPrecondition>;
}
export interface Transaction {
    delegateCall: boolean;
    revertOnError: boolean;
    gasLimit: string;
    target: string;
    value: string;
    data: string;
}
export interface TxnLogUser {
    username: string;
}
export interface TxnLogTransfer {
    transferType: TransferType;
    contractAddress: string;
    from: string;
    to: string;
    ids: Array<string>;
    amounts: Array<string>;
}
export interface SentTransactionsFilter {
    pending?: boolean;
    failed?: boolean;
}
export interface SimulateResult {
    executed: boolean;
    succeeded: boolean;
    result?: string;
    reason?: string;
    gasUsed: number;
    gasLimit: number;
}
export interface FeeOption {
    token: FeeToken;
    to: string;
    value: string;
    gasLimit: number;
}
export interface FeeToken {
    chainId: number;
    name: string;
    symbol: string;
    type: FeeTokenType;
    decimals?: number;
    logoURL: string;
    contractAddress?: string;
    tokenID?: string;
}
export interface Page {
    pageSize?: number;
    page?: number;
    more?: boolean;
    totalRecords?: number;
    column?: string;
    before?: any;
    after?: any;
    sort?: Array<SortBy>;
}
export interface SortBy {
    column: string;
    order: SortOrder;
}
export interface Relayer {
    ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>;
    version(headers?: object, signal?: AbortSignal): Promise<VersionReturn>;
    runtimeStatus(headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn>;
    getSequenceContext(headers?: object, signal?: AbortSignal): Promise<GetSequenceContextReturn>;
    getChainID(headers?: object, signal?: AbortSignal): Promise<GetChainIDReturn>;
    sendMetaTxn(args: SendMetaTxnArgs, headers?: object, signal?: AbortSignal): Promise<SendMetaTxnReturn>;
    getMetaTxnNonce(args: GetMetaTxnNonceArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnNonceReturn>;
    getMetaTxnReceipt(args: GetMetaTxnReceiptArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnReceiptReturn>;
    simulate(args: SimulateArgs, headers?: object, signal?: AbortSignal): Promise<SimulateReturn>;
    updateMetaTxnGasLimits(args: UpdateMetaTxnGasLimitsArgs, headers?: object, signal?: AbortSignal): Promise<UpdateMetaTxnGasLimitsReturn>;
    feeTokens(headers?: object, signal?: AbortSignal): Promise<FeeTokensReturn>;
    feeOptions(args: FeeOptionsArgs, headers?: object, signal?: AbortSignal): Promise<FeeOptionsReturn>;
    getMetaTxnNetworkFeeOptions(args: GetMetaTxnNetworkFeeOptionsArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnNetworkFeeOptionsReturn>;
    getMetaTransactions(args: GetMetaTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTransactionsReturn>;
    getTransactionCost(args: GetTransactionCostArgs, headers?: object, signal?: AbortSignal): Promise<GetTransactionCostReturn>;
    sentTransactions(args: SentTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<SentTransactionsReturn>;
    pendingTransactions(args: PendingTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<PendingTransactionsReturn>;
    getGasTank(args: GetGasTankArgs, headers?: object, signal?: AbortSignal): Promise<GetGasTankReturn>;
    addGasTank(args: AddGasTankArgs, headers?: object, signal?: AbortSignal): Promise<AddGasTankReturn>;
    updateGasTank(args: UpdateGasTankArgs, headers?: object, signal?: AbortSignal): Promise<UpdateGasTankReturn>;
    nextGasTankBalanceAdjustmentNonce(args: NextGasTankBalanceAdjustmentNonceArgs, headers?: object, signal?: AbortSignal): Promise<NextGasTankBalanceAdjustmentNonceReturn>;
    adjustGasTankBalance(args: AdjustGasTankBalanceArgs, headers?: object, signal?: AbortSignal): Promise<AdjustGasTankBalanceReturn>;
    getGasTankBalanceAdjustment(args: GetGasTankBalanceAdjustmentArgs, headers?: object, signal?: AbortSignal): Promise<GetGasTankBalanceAdjustmentReturn>;
    listGasTankBalanceAdjustments(args: ListGasTankBalanceAdjustmentsArgs, headers?: object, signal?: AbortSignal): Promise<ListGasTankBalanceAdjustmentsReturn>;
    listGasSponsors(args: ListGasSponsorsArgs, headers?: object, signal?: AbortSignal): Promise<ListGasSponsorsReturn>;
    getGasSponsor(args: GetGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<GetGasSponsorReturn>;
    addGasSponsor(args: AddGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<AddGasSponsorReturn>;
    updateGasSponsor(args: UpdateGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<UpdateGasSponsorReturn>;
    removeGasSponsor(args: RemoveGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<RemoveGasSponsorReturn>;
    addressGasSponsors(args: AddressGasSponsorsArgs, headers?: object, signal?: AbortSignal): Promise<AddressGasSponsorsReturn>;
    getProjectBalance(args: GetProjectBalanceArgs, headers?: object, signal?: AbortSignal): Promise<GetProjectBalanceReturn>;
    adjustProjectBalance(args: AdjustProjectBalanceArgs, headers?: object, signal?: AbortSignal): Promise<AdjustProjectBalanceReturn>;
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
export interface GetSequenceContextArgs {
}
export interface GetSequenceContextReturn {
    data: SequenceContext;
}
export interface GetChainIDArgs {
}
export interface GetChainIDReturn {
    chainID: number;
}
export interface SendMetaTxnArgs {
    call: MetaTxn;
    quote?: string;
    projectID?: number;
    preconditions?: Array<IntentPrecondition>;
}
export interface SendMetaTxnReturn {
    status: boolean;
    txnHash: string;
}
export interface GetMetaTxnNonceArgs {
    walletContractAddress: string;
    space?: string;
}
export interface GetMetaTxnNonceReturn {
    nonce: string;
}
export interface GetMetaTxnReceiptArgs {
    metaTxID: string;
}
export interface GetMetaTxnReceiptReturn {
    receipt: MetaTxnReceipt;
}
export interface SimulateArgs {
    wallet: string;
    transactions: string;
}
export interface SimulateReturn {
    results: Array<SimulateResult>;
}
export interface UpdateMetaTxnGasLimitsArgs {
    walletAddress: string;
    walletConfig: any;
    payload: string;
}
export interface UpdateMetaTxnGasLimitsReturn {
    payload: string;
}
export interface FeeTokensArgs {
}
export interface FeeTokensReturn {
    isFeeRequired: boolean;
    tokens: Array<FeeToken>;
}
export interface FeeOptionsArgs {
    wallet: string;
    to: string;
    data: string;
    simulate?: boolean;
}
export interface FeeOptionsReturn {
    options: Array<FeeOption>;
    sponsored: boolean;
    quote?: string;
}
export interface GetMetaTxnNetworkFeeOptionsArgs {
    walletConfig: any;
    payload: string;
}
export interface GetMetaTxnNetworkFeeOptionsReturn {
    options: Array<FeeOption>;
}
export interface GetMetaTransactionsArgs {
    projectId: number;
    page?: Page;
}
export interface GetMetaTransactionsReturn {
    page: Page;
    transactions: Array<MetaTxnLog>;
}
export interface GetTransactionCostArgs {
    projectId: number;
    from: string;
    to: string;
}
export interface GetTransactionCostReturn {
    cost: number;
}
export interface SentTransactionsArgs {
    filter?: SentTransactionsFilter;
    page?: Page;
}
export interface SentTransactionsReturn {
    page: Page;
    transactions: Array<Transaction>;
}
export interface PendingTransactionsArgs {
    page?: Page;
}
export interface PendingTransactionsReturn {
    page: Page;
    transactions: Array<Transaction>;
}
export interface GetGasTankArgs {
    id: number;
}
export interface GetGasTankReturn {
    gasTank: GasTank;
}
export interface AddGasTankArgs {
    name: string;
    feeMarkupFactor: number;
    unlimited?: boolean;
}
export interface AddGasTankReturn {
    status: boolean;
    gasTank: GasTank;
}
export interface UpdateGasTankArgs {
    id: number;
    name?: string;
    feeMarkupFactor?: number;
    unlimited?: boolean;
}
export interface UpdateGasTankReturn {
    status: boolean;
    gasTank: GasTank;
}
export interface NextGasTankBalanceAdjustmentNonceArgs {
    id: number;
}
export interface NextGasTankBalanceAdjustmentNonceReturn {
    nonce: number;
}
export interface AdjustGasTankBalanceArgs {
    id: number;
    nonce: number;
    amount: number;
}
export interface AdjustGasTankBalanceReturn {
    status: boolean;
    adjustment: GasTankBalanceAdjustment;
}
export interface GetGasTankBalanceAdjustmentArgs {
    id: number;
    nonce: number;
}
export interface GetGasTankBalanceAdjustmentReturn {
    adjustment: GasTankBalanceAdjustment;
}
export interface ListGasTankBalanceAdjustmentsArgs {
    id: number;
    page?: Page;
}
export interface ListGasTankBalanceAdjustmentsReturn {
    page: Page;
    adjustments: Array<GasTankBalanceAdjustment>;
}
export interface ListGasSponsorsArgs {
    projectId: number;
    page?: Page;
}
export interface ListGasSponsorsReturn {
    page: Page;
    gasSponsors: Array<GasSponsor>;
}
export interface GetGasSponsorArgs {
    projectId: number;
    id: number;
}
export interface GetGasSponsorReturn {
    gasSponsor: GasSponsor;
}
export interface AddGasSponsorArgs {
    projectId: number;
    address: string;
    name?: string;
    active?: boolean;
}
export interface AddGasSponsorReturn {
    status: boolean;
    gasSponsor: GasSponsor;
}
export interface UpdateGasSponsorArgs {
    projectId: number;
    id: number;
    name?: string;
    active?: boolean;
}
export interface UpdateGasSponsorReturn {
    status: boolean;
    gasSponsor: GasSponsor;
}
export interface RemoveGasSponsorArgs {
    projectId: number;
    id: number;
}
export interface RemoveGasSponsorReturn {
    status: boolean;
}
export interface AddressGasSponsorsArgs {
    address: string;
    page?: Page;
}
export interface AddressGasSponsorsReturn {
    page: Page;
    gasSponsors: Array<GasSponsor>;
}
export interface GetProjectBalanceArgs {
    projectId: number;
}
export interface GetProjectBalanceReturn {
    balance: number;
}
export interface AdjustProjectBalanceArgs {
    projectId: number;
    amount: number;
    identifier: string;
}
export interface AdjustProjectBalanceReturn {
    balance: number;
}
export declare class Relayer implements Relayer {
    protected hostname: string;
    protected fetch: Fetch;
    protected path: string;
    constructor(hostname: string, fetch: Fetch);
    private url;
    ping: (headers?: object, signal?: AbortSignal) => Promise<PingReturn>;
    version: (headers?: object, signal?: AbortSignal) => Promise<VersionReturn>;
    runtimeStatus: (headers?: object, signal?: AbortSignal) => Promise<RuntimeStatusReturn>;
    getSequenceContext: (headers?: object, signal?: AbortSignal) => Promise<GetSequenceContextReturn>;
    getChainID: (headers?: object, signal?: AbortSignal) => Promise<GetChainIDReturn>;
    sendMetaTxn: (args: SendMetaTxnArgs, headers?: object, signal?: AbortSignal) => Promise<SendMetaTxnReturn>;
    getMetaTxnNonce: (args: GetMetaTxnNonceArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnNonceReturn>;
    getMetaTxnReceipt: (args: GetMetaTxnReceiptArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnReceiptReturn>;
    simulate: (args: SimulateArgs, headers?: object, signal?: AbortSignal) => Promise<SimulateReturn>;
    updateMetaTxnGasLimits: (args: UpdateMetaTxnGasLimitsArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateMetaTxnGasLimitsReturn>;
    feeTokens: (headers?: object, signal?: AbortSignal) => Promise<FeeTokensReturn>;
    feeOptions: (args: FeeOptionsArgs, headers?: object, signal?: AbortSignal) => Promise<FeeOptionsReturn>;
    getMetaTxnNetworkFeeOptions: (args: GetMetaTxnNetworkFeeOptionsArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnNetworkFeeOptionsReturn>;
    getMetaTransactions: (args: GetMetaTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTransactionsReturn>;
    getTransactionCost: (args: GetTransactionCostArgs, headers?: object, signal?: AbortSignal) => Promise<GetTransactionCostReturn>;
    sentTransactions: (args: SentTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<SentTransactionsReturn>;
    pendingTransactions: (args: PendingTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<PendingTransactionsReturn>;
    getGasTank: (args: GetGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasTankReturn>;
    addGasTank: (args: AddGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<AddGasTankReturn>;
    updateGasTank: (args: UpdateGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateGasTankReturn>;
    nextGasTankBalanceAdjustmentNonce: (args: NextGasTankBalanceAdjustmentNonceArgs, headers?: object, signal?: AbortSignal) => Promise<NextGasTankBalanceAdjustmentNonceReturn>;
    adjustGasTankBalance: (args: AdjustGasTankBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<AdjustGasTankBalanceReturn>;
    getGasTankBalanceAdjustment: (args: GetGasTankBalanceAdjustmentArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasTankBalanceAdjustmentReturn>;
    listGasTankBalanceAdjustments: (args: ListGasTankBalanceAdjustmentsArgs, headers?: object, signal?: AbortSignal) => Promise<ListGasTankBalanceAdjustmentsReturn>;
    listGasSponsors: (args: ListGasSponsorsArgs, headers?: object, signal?: AbortSignal) => Promise<ListGasSponsorsReturn>;
    getGasSponsor: (args: GetGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasSponsorReturn>;
    addGasSponsor: (args: AddGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<AddGasSponsorReturn>;
    updateGasSponsor: (args: UpdateGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateGasSponsorReturn>;
    removeGasSponsor: (args: RemoveGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<RemoveGasSponsorReturn>;
    addressGasSponsors: (args: AddressGasSponsorsArgs, headers?: object, signal?: AbortSignal) => Promise<AddressGasSponsorsReturn>;
    getProjectBalance: (args: GetProjectBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<GetProjectBalanceReturn>;
    adjustProjectBalance: (args: AdjustProjectBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<AdjustProjectBalanceReturn>;
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
export declare class ProjectNotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AccessKeyNotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AccessKeyMismatchError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InvalidOriginError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InvalidServiceError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class UnauthorizedUserError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class QuotaExceededError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class QuotaRateLimitError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class NoDefaultKeyError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class MaxAccessKeysError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class AtLeastOneKeyError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class TimeoutError extends WebrpcError {
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
export declare class NotFoundError extends WebrpcError {
    constructor(name?: string, code?: number, message?: string, status?: number, cause?: string);
}
export declare class InsufficientFeeError extends WebrpcError {
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
    ProjectNotFound = "ProjectNotFound",
    AccessKeyNotFound = "AccessKeyNotFound",
    AccessKeyMismatch = "AccessKeyMismatch",
    InvalidOrigin = "InvalidOrigin",
    InvalidService = "InvalidService",
    UnauthorizedUser = "UnauthorizedUser",
    QuotaExceeded = "QuotaExceeded",
    QuotaRateLimit = "QuotaRateLimit",
    NoDefaultKey = "NoDefaultKey",
    MaxAccessKeys = "MaxAccessKeys",
    AtLeastOneKey = "AtLeastOneKey",
    Timeout = "Timeout",
    InvalidArgument = "InvalidArgument",
    Unavailable = "Unavailable",
    QueryFailed = "QueryFailed",
    NotFound = "NotFound",
    InsufficientFee = "InsufficientFee"
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
    ProjectNotFound = 1008,
    AccessKeyNotFound = 1101,
    AccessKeyMismatch = 1102,
    InvalidOrigin = 1103,
    InvalidService = 1104,
    UnauthorizedUser = 1105,
    QuotaExceeded = 1200,
    QuotaRateLimit = 1201,
    NoDefaultKey = 1300,
    MaxAccessKeys = 1301,
    AtLeastOneKey = 1302,
    Timeout = 1900,
    InvalidArgument = 2001,
    Unavailable = 2002,
    QueryFailed = 2003,
    NotFound = 3000,
    InsufficientFee = 3004
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export {};
//# sourceMappingURL=relayer.gen.d.ts.map
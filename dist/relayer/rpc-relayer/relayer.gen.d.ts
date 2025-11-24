export declare const WebrpcVersion = "v1";
export declare const WebrpcSchemaVersion = "v0.4.1";
export declare const WebrpcSchemaHash = "7f8a4b83b00e0b6849c76c2ff0e23931e26b3d9f";
export interface RelayerClient {
    ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>;
    version(headers?: object, signal?: AbortSignal): Promise<VersionReturn>;
    runtimeStatus(headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn>;
    getSequenceContext(headers?: object, signal?: AbortSignal): Promise<GetSequenceContextReturn>;
    getChainID(headers?: object, signal?: AbortSignal): Promise<GetChainIDReturn>;
    /**
     *
     * Transactions
     *
     * TODO (future): rename this to just, 'SendTransaction(txn: MetaTransaction)' or 'SendTransaction(txn: SignedTransaction)', or something..
     * Project ID is only used by service and admin calls. Other clients must have projectID passed via the context
     * TODO: rename return txnHash: string to metaTxnID: string
     */
    sendMetaTxn(req: SendMetaTxnArgs, headers?: object, signal?: AbortSignal): Promise<SendMetaTxnReturn>;
    getMetaTxnNonce(req: GetMetaTxnNonceArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnNonceReturn>;
    /**
     * TODO: one day, make GetMetaTxnReceipt respond immediately with receipt or not
     * and add WaitTransactionReceipt method, which will block and wait, similar to how GetMetaTxnReceipt
     * is implemented now.
     * For backwards compat, we can leave the current GetMetaTxnReceipt how it is, an deprecate it, and introduce
     * new, GetTransactionReceipt and WaitTransactionReceipt methods
     * we can also accept metaTxnId and txnHash .. so can take either or.. I wonder if ERC-4337 has any convention on this?
     */
    getMetaTxnReceipt(req: GetMetaTxnReceiptArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnReceiptReturn>;
    simulate(req: SimulateArgs, headers?: object, signal?: AbortSignal): Promise<SimulateReturn>;
    simulateV3(req: SimulateV3Args, headers?: object, signal?: AbortSignal): Promise<SimulateV3Return>;
    /**
     * TODO: deprecated, to be removed by https://github.com/0xsequence/stack/pull/356 at a later date
     */
    updateMetaTxnGasLimits(req: UpdateMetaTxnGasLimitsArgs, headers?: object, signal?: AbortSignal): Promise<UpdateMetaTxnGasLimitsReturn>;
    feeTokens(headers?: object, signal?: AbortSignal): Promise<FeeTokensReturn>;
    feeOptions(req: FeeOptionsArgs, headers?: object, signal?: AbortSignal): Promise<FeeOptionsReturn>;
    /**
     * TODO: deprecated, to be removed by https://github.com/0xsequence/stack/pull/356 at a later date
     */
    getMetaTxnNetworkFeeOptions(req: GetMetaTxnNetworkFeeOptionsArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTxnNetworkFeeOptionsReturn>;
    getMetaTransactions(req: GetMetaTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<GetMetaTransactionsReturn>;
    getTransactionCost(req: GetTransactionCostArgs, headers?: object, signal?: AbortSignal): Promise<GetTransactionCostReturn>;
    /**
     * Sent transactions from an account. If filter is omitted then it will return all transactions.
     */
    sentTransactions(req: SentTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<SentTransactionsReturn>;
    /**
     * Pending transactions waiting to be mined for an account. This endpoint is just a sugar of `SentTransactions`
     * with the filter set to pending: true.
     */
    pendingTransactions(req: PendingTransactionsArgs, headers?: object, signal?: AbortSignal): Promise<PendingTransactionsReturn>;
    /**
     * Legacy Gas Tank
     */
    getGasTank(req: GetGasTankArgs, headers?: object, signal?: AbortSignal): Promise<GetGasTankReturn>;
    addGasTank(req: AddGasTankArgs, headers?: object, signal?: AbortSignal): Promise<AddGasTankReturn>;
    updateGasTank(req: UpdateGasTankArgs, headers?: object, signal?: AbortSignal): Promise<UpdateGasTankReturn>;
    /**
     * Legacy Gas Adjustment
     */
    nextGasTankBalanceAdjustmentNonce(req: NextGasTankBalanceAdjustmentNonceArgs, headers?: object, signal?: AbortSignal): Promise<NextGasTankBalanceAdjustmentNonceReturn>;
    adjustGasTankBalance(req: AdjustGasTankBalanceArgs, headers?: object, signal?: AbortSignal): Promise<AdjustGasTankBalanceReturn>;
    getGasTankBalanceAdjustment(req: GetGasTankBalanceAdjustmentArgs, headers?: object, signal?: AbortSignal): Promise<GetGasTankBalanceAdjustmentReturn>;
    listGasTankBalanceAdjustments(req: ListGasTankBalanceAdjustmentsArgs, headers?: object, signal?: AbortSignal): Promise<ListGasTankBalanceAdjustmentsReturn>;
    /**
     * Gas Sponsorship
     */
    listGasSponsors(req: ListGasSponsorsArgs, headers?: object, signal?: AbortSignal): Promise<ListGasSponsorsReturn>;
    getGasSponsor(req: GetGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<GetGasSponsorReturn>;
    addGasSponsor(req: AddGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<AddGasSponsorReturn>;
    updateGasSponsor(req: UpdateGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<UpdateGasSponsorReturn>;
    removeGasSponsor(req: RemoveGasSponsorArgs, headers?: object, signal?: AbortSignal): Promise<RemoveGasSponsorReturn>;
    /**
     * Gas Sponsor Lookup
     */
    addressGasSponsors(req: AddressGasSponsorsArgs, headers?: object, signal?: AbortSignal): Promise<AddressGasSponsorsReturn>;
    /**
     * Project Balance
     */
    getProjectBalance(req: GetProjectBalanceArgs, headers?: object, signal?: AbortSignal): Promise<GetProjectBalanceReturn>;
    adjustProjectBalance(req: AdjustProjectBalanceArgs, headers?: object, signal?: AbortSignal): Promise<AdjustProjectBalanceReturn>;
}
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
export declare enum SimulateStatus {
    SKIPPED = "SKIPPED",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED",
    ABORTED = "ABORTED",
    REVERTED = "REVERTED",
    NOT_ENOUGH_GAS = "NOT_ENOUGH_GAS"
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
export interface Transactions {
    chainID: string;
    transactions: Array<Transaction>;
    preconditions?: Array<TransactionPrecondition>;
}
export interface Transaction {
    delegateCall: boolean;
    revertOnError: boolean;
    gasLimit: string;
    target: string;
    value: string;
    data: string;
}
export interface TransactionPrecondition {
    type: string;
    chainId: number;
    ownerAddress: string;
    tokenAddress: string;
    minAmount: bigint;
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
export interface SimulateV3Result {
    status: SimulateStatus;
    result?: string;
    error?: string;
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
    preconditions?: Array<TransactionPrecondition>;
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
export interface SimulateV3Args {
    wallet: string;
    calls: string;
}
export interface SimulateV3Return {
    results: Array<SimulateV3Result>;
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
    paymentAddress: string;
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
export declare class Relayer implements RelayerClient {
    protected hostname: string;
    protected fetch: Fetch;
    protected path: string;
    constructor(hostname: string, fetch: Fetch);
    private url;
    queryKey: {
        ping: () => readonly ["Relayer", "ping"];
        version: () => readonly ["Relayer", "version"];
        runtimeStatus: () => readonly ["Relayer", "runtimeStatus"];
        getSequenceContext: () => readonly ["Relayer", "getSequenceContext"];
        getChainID: () => readonly ["Relayer", "getChainID"];
        sendMetaTxn: (req: SendMetaTxnArgs) => readonly ["Relayer", "sendMetaTxn", SendMetaTxnArgs];
        getMetaTxnNonce: (req: GetMetaTxnNonceArgs) => readonly ["Relayer", "getMetaTxnNonce", GetMetaTxnNonceArgs];
        getMetaTxnReceipt: (req: GetMetaTxnReceiptArgs) => readonly ["Relayer", "getMetaTxnReceipt", GetMetaTxnReceiptArgs];
        simulate: (req: SimulateArgs) => readonly ["Relayer", "simulate", SimulateArgs];
        simulateV3: (req: SimulateV3Args) => readonly ["Relayer", "simulateV3", SimulateV3Args];
        updateMetaTxnGasLimits: (req: UpdateMetaTxnGasLimitsArgs) => readonly ["Relayer", "updateMetaTxnGasLimits", UpdateMetaTxnGasLimitsArgs];
        feeTokens: () => readonly ["Relayer", "feeTokens"];
        feeOptions: (req: FeeOptionsArgs) => readonly ["Relayer", "feeOptions", FeeOptionsArgs];
        getMetaTxnNetworkFeeOptions: (req: GetMetaTxnNetworkFeeOptionsArgs) => readonly ["Relayer", "getMetaTxnNetworkFeeOptions", GetMetaTxnNetworkFeeOptionsArgs];
        getMetaTransactions: (req: GetMetaTransactionsArgs) => readonly ["Relayer", "getMetaTransactions", GetMetaTransactionsArgs];
        getTransactionCost: (req: GetTransactionCostArgs) => readonly ["Relayer", "getTransactionCost", GetTransactionCostArgs];
        sentTransactions: (req: SentTransactionsArgs) => readonly ["Relayer", "sentTransactions", SentTransactionsArgs];
        pendingTransactions: (req: PendingTransactionsArgs) => readonly ["Relayer", "pendingTransactions", PendingTransactionsArgs];
        getGasTank: (req: GetGasTankArgs) => readonly ["Relayer", "getGasTank", GetGasTankArgs];
        addGasTank: (req: AddGasTankArgs) => readonly ["Relayer", "addGasTank", AddGasTankArgs];
        updateGasTank: (req: UpdateGasTankArgs) => readonly ["Relayer", "updateGasTank", UpdateGasTankArgs];
        nextGasTankBalanceAdjustmentNonce: (req: NextGasTankBalanceAdjustmentNonceArgs) => readonly ["Relayer", "nextGasTankBalanceAdjustmentNonce", NextGasTankBalanceAdjustmentNonceArgs];
        adjustGasTankBalance: (req: AdjustGasTankBalanceArgs) => readonly ["Relayer", "adjustGasTankBalance", AdjustGasTankBalanceArgs];
        getGasTankBalanceAdjustment: (req: GetGasTankBalanceAdjustmentArgs) => readonly ["Relayer", "getGasTankBalanceAdjustment", GetGasTankBalanceAdjustmentArgs];
        listGasTankBalanceAdjustments: (req: ListGasTankBalanceAdjustmentsArgs) => readonly ["Relayer", "listGasTankBalanceAdjustments", ListGasTankBalanceAdjustmentsArgs];
        listGasSponsors: (req: ListGasSponsorsArgs) => readonly ["Relayer", "listGasSponsors", ListGasSponsorsArgs];
        getGasSponsor: (req: GetGasSponsorArgs) => readonly ["Relayer", "getGasSponsor", GetGasSponsorArgs];
        addGasSponsor: (req: AddGasSponsorArgs) => readonly ["Relayer", "addGasSponsor", AddGasSponsorArgs];
        updateGasSponsor: (req: UpdateGasSponsorArgs) => readonly ["Relayer", "updateGasSponsor", UpdateGasSponsorArgs];
        removeGasSponsor: (req: RemoveGasSponsorArgs) => readonly ["Relayer", "removeGasSponsor", RemoveGasSponsorArgs];
        addressGasSponsors: (req: AddressGasSponsorsArgs) => readonly ["Relayer", "addressGasSponsors", AddressGasSponsorsArgs];
        getProjectBalance: (req: GetProjectBalanceArgs) => readonly ["Relayer", "getProjectBalance", GetProjectBalanceArgs];
        adjustProjectBalance: (req: AdjustProjectBalanceArgs) => readonly ["Relayer", "adjustProjectBalance", AdjustProjectBalanceArgs];
    };
    ping: (headers?: object, signal?: AbortSignal) => Promise<PingReturn>;
    version: (headers?: object, signal?: AbortSignal) => Promise<VersionReturn>;
    runtimeStatus: (headers?: object, signal?: AbortSignal) => Promise<RuntimeStatusReturn>;
    getSequenceContext: (headers?: object, signal?: AbortSignal) => Promise<GetSequenceContextReturn>;
    getChainID: (headers?: object, signal?: AbortSignal) => Promise<GetChainIDReturn>;
    sendMetaTxn: (req: SendMetaTxnArgs, headers?: object, signal?: AbortSignal) => Promise<SendMetaTxnReturn>;
    getMetaTxnNonce: (req: GetMetaTxnNonceArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnNonceReturn>;
    getMetaTxnReceipt: (req: GetMetaTxnReceiptArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnReceiptReturn>;
    simulate: (req: SimulateArgs, headers?: object, signal?: AbortSignal) => Promise<SimulateReturn>;
    simulateV3: (req: SimulateV3Args, headers?: object, signal?: AbortSignal) => Promise<SimulateV3Return>;
    updateMetaTxnGasLimits: (req: UpdateMetaTxnGasLimitsArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateMetaTxnGasLimitsReturn>;
    feeTokens: (headers?: object, signal?: AbortSignal) => Promise<FeeTokensReturn>;
    feeOptions: (req: FeeOptionsArgs, headers?: object, signal?: AbortSignal) => Promise<FeeOptionsReturn>;
    getMetaTxnNetworkFeeOptions: (req: GetMetaTxnNetworkFeeOptionsArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTxnNetworkFeeOptionsReturn>;
    getMetaTransactions: (req: GetMetaTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<GetMetaTransactionsReturn>;
    getTransactionCost: (req: GetTransactionCostArgs, headers?: object, signal?: AbortSignal) => Promise<GetTransactionCostReturn>;
    sentTransactions: (req: SentTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<SentTransactionsReturn>;
    pendingTransactions: (req: PendingTransactionsArgs, headers?: object, signal?: AbortSignal) => Promise<PendingTransactionsReturn>;
    getGasTank: (req: GetGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasTankReturn>;
    addGasTank: (req: AddGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<AddGasTankReturn>;
    updateGasTank: (req: UpdateGasTankArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateGasTankReturn>;
    nextGasTankBalanceAdjustmentNonce: (req: NextGasTankBalanceAdjustmentNonceArgs, headers?: object, signal?: AbortSignal) => Promise<NextGasTankBalanceAdjustmentNonceReturn>;
    adjustGasTankBalance: (req: AdjustGasTankBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<AdjustGasTankBalanceReturn>;
    getGasTankBalanceAdjustment: (req: GetGasTankBalanceAdjustmentArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasTankBalanceAdjustmentReturn>;
    listGasTankBalanceAdjustments: (req: ListGasTankBalanceAdjustmentsArgs, headers?: object, signal?: AbortSignal) => Promise<ListGasTankBalanceAdjustmentsReturn>;
    listGasSponsors: (req: ListGasSponsorsArgs, headers?: object, signal?: AbortSignal) => Promise<ListGasSponsorsReturn>;
    getGasSponsor: (req: GetGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<GetGasSponsorReturn>;
    addGasSponsor: (req: AddGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<AddGasSponsorReturn>;
    updateGasSponsor: (req: UpdateGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<UpdateGasSponsorReturn>;
    removeGasSponsor: (req: RemoveGasSponsorArgs, headers?: object, signal?: AbortSignal) => Promise<RemoveGasSponsorReturn>;
    addressGasSponsors: (req: AddressGasSponsorsArgs, headers?: object, signal?: AbortSignal) => Promise<AddressGasSponsorsReturn>;
    getProjectBalance: (req: GetProjectBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<GetProjectBalanceReturn>;
    adjustProjectBalance: (req: AdjustProjectBalanceArgs, headers?: object, signal?: AbortSignal) => Promise<AdjustProjectBalanceReturn>;
}
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export declare const JsonEncode: <T = any>(obj: T, typ?: string) => string;
export declare const JsonDecode: <T = any>(data: string | any, typ?: string) => T;
type WebrpcErrorParams = {
    name?: string;
    code?: number;
    message?: string;
    status?: number;
    cause?: string;
};
export declare class WebrpcError extends Error {
    code: number;
    status: number;
    constructor(error?: WebrpcErrorParams);
    static new(payload: any): WebrpcError;
}
export declare class WebrpcEndpointError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcRequestFailedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcBadRouteError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcBadMethodError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcBadRequestError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcBadResponseError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcServerPanicError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcInternalErrorError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcClientAbortedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcStreamLostError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class WebrpcStreamFinishedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class UnauthorizedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class PermissionDeniedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class SessionExpiredError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class MethodNotFoundError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class RequestConflictError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class AbortedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class GeoblockedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class RateLimitedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class ProjectNotFoundError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class AccessKeyNotFoundError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class AccessKeyMismatchError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class InvalidOriginError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class InvalidServiceError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class UnauthorizedUserError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class QuotaExceededError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class QuotaRateLimitError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class NoDefaultKeyError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class MaxAccessKeysError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class AtLeastOneKeyError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class TimeoutError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class InvalidArgumentError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class UnavailableError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class QueryFailedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class NotFoundError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class InsufficientFeeError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class NotEnoughBalanceError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
}
export declare class SimulationFailedError extends WebrpcError {
    constructor(error?: WebrpcErrorParams);
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
    WebrpcClientAborted = "WebrpcClientAborted",
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
    InsufficientFee = "InsufficientFee",
    NotEnoughBalance = "NotEnoughBalance",
    SimulationFailed = "SimulationFailed"
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
    WebrpcClientAborted = -8,
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
    InsufficientFee = 3004,
    NotEnoughBalance = 3005,
    SimulationFailed = 3006
}
export declare const webrpcErrorByCode: {
    [code: number]: any;
};
export declare const WebrpcHeader = "Webrpc";
export declare const WebrpcHeaderValue = "webrpc@v0.30.2;gen-typescript@v0.22.2;sequence-relayer@v0.4.1";
type WebrpcGenVersions = {
    WebrpcGenVersion: string;
    codeGenName: string;
    codeGenVersion: string;
    schemaName: string;
    schemaVersion: string;
};
export declare function VersionFromHeader(headers: Headers): WebrpcGenVersions;
export {};
//# sourceMappingURL=relayer.gen.d.ts.map
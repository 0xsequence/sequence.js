/* eslint-disable */
// sequence-indexer v0.4.0 71cd081c5ca2372bf92a897ae1aa4ebf93ffd0fc
// --
// Code generated by webrpc-gen@v0.21.1 with typescript generator. DO NOT EDIT.
//
// webrpc-gen -schema=indexer.ridl -service=IndexerGateway -target=typescript -client -out=./clients/indexergw/indexer.gen.ts

export const WebrpcHeader = 'Webrpc'

export const WebrpcHeaderValue = 'webrpc@v0.21.1;gen-typescript@v0.15.1;sequence-indexer@v0.4.0'

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.4.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = '71cd081c5ca2372bf92a897ae1aa4ebf93ffd0fc'

type WebrpcGenVersions = {
  webrpcGenVersion: string
  codeGenName: string
  codeGenVersion: string
  schemaName: string
  schemaVersion: string
}

export function VersionFromHeader(headers: Headers): WebrpcGenVersions {
  const headerValue = headers.get(WebrpcHeader)
  if (!headerValue) {
    return {
      webrpcGenVersion: '',
      codeGenName: '',
      codeGenVersion: '',
      schemaName: '',
      schemaVersion: ''
    }
  }

  return parseWebrpcGenVersions(headerValue)
}

function parseWebrpcGenVersions(header: string): WebrpcGenVersions {
  const versions = header.split(';')
  if (versions.length < 3) {
    return {
      webrpcGenVersion: '',
      codeGenName: '',
      codeGenVersion: '',
      schemaName: '',
      schemaVersion: ''
    }
  }

  const [_, webrpcGenVersion] = versions[0].split('@')
  const [codeGenName, codeGenVersion] = versions[1].split('@')
  const [schemaName, schemaVersion] = versions[2].split('@')

  return {
    webrpcGenVersion,
    codeGenName,
    codeGenVersion,
    schemaName,
    schemaVersion
  }
}

//
// Types
//

export interface ContractInfo {
  chainId: number
  address: string
  name: string
  type: string
  symbol: string
  decimals?: number
  logoURI: string
  deployed: boolean
  bytecodeHash: string
  extensions: ContractInfoExtensions
  updatedAt: string
}

export interface ContractInfoExtensions {
  link: string
  description: string
  ogImage: string
  originChainId: number
  originAddress: string
  blacklist: boolean
  verified: boolean
  verifiedBy: string
  featured: boolean
}

export interface TokenMetadata {
  tokenId: string
  name: string
  description?: string
  image?: string
  video?: string
  audio?: string
  properties?: { [key: string]: any }
  attributes: Array<{ [key: string]: any }>
  image_data?: string
  external_url?: string
  background_color?: string
  animation_url?: string
  decimals?: number
  updatedAt?: string
  assets?: Array<Asset>
}

export interface Asset {
  id: number
  collectionId: number
  tokenId?: string
  url?: string
  metadataField: string
  name?: string
  filesize?: number
  mimeType?: string
  width?: number
  height?: number
  updatedAt?: string
}

export enum ContractType {
  UNKNOWN = 'UNKNOWN',
  NATIVE = 'NATIVE',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  SEQUENCE_WALLET = 'SEQUENCE_WALLET',
  ERC20_BRIDGE = 'ERC20_BRIDGE',
  ERC721_BRIDGE = 'ERC721_BRIDGE',
  ERC1155_BRIDGE = 'ERC1155_BRIDGE',
  SEQ_MARKETPLACE = 'SEQ_MARKETPLACE'
}

export enum EventLogType {
  UNKNOWN = 'UNKNOWN',
  BLOCK_ADDED = 'BLOCK_ADDED',
  BLOCK_REMOVED = 'BLOCK_REMOVED'
}

export enum EventLogDataType {
  EVENT = 'EVENT',
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  NATIVE_TOKEN_TRANSFER = 'NATIVE_TOKEN_TRANSFER',
  SEQUENCE_TXN = 'SEQUENCE_TXN'
}

export enum OrderStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

export enum TxnTransferType {
  UNKNOWN = 'UNKNOWN',
  SEND = 'SEND',
  RECEIVE = 'RECEIVE'
}

export enum TransactionStatus {
  FAILED = 'FAILED',
  SUCCESSFUL = 'SUCCESSFUL'
}

export enum TransactionType {
  LegacyTxnType = 'LegacyTxnType',
  AccessListTxnType = 'AccessListTxnType',
  DynamicFeeTxnType = 'DynamicFeeTxnType'
}

export enum SortOrder {
  DESC = 'DESC',
  ASC = 'ASC'
}

export enum ContractVerificationStatus {
  VERIFIED = 'VERIFIED',
  UNVERIFIED = 'UNVERIFIED',
  ALL = 'ALL'
}

export interface Version {
  webrpcVersion: string
  schemaVersion: string
  schemaHash: string
  appVersion: string
}

export interface RuntimeStatus {
  healthOK: boolean
  indexerEnabled: boolean
  startTime: string
  uptime: number
  ver: string
  branch: string
  commitHash: string
  chainID: number
  checks: RuntimeChecks
}

export interface WALWriterRuntimeStatus {
  healthOK: boolean
  startTime: string
  uptime: number
  ver: string
  branch: string
  commitHash: string
  chainID: number
  percentWALWritten: number
}

export interface RuntimeChecks {
  running: boolean
  runnables: any
  cgoEnabled: boolean
  quotaControlEnabled: boolean
  syncMode: string
  percentIndexed: number
  lastBlockNum: number
  lastBlockNumWithState: number
  bloomStatus: BloomStatus
  bond: Bond
  diskUsage: DiskUsage
}

export interface DiskUsage {
  humanReadable: string
  used: number
  size: number
  percent: number
  dirs: { [key: string]: string }
}

export interface Bond {
  pebble: PebbleMetrics
  estimatedDiskUsagePerTable: any
  estimatedDiskUsageTotal: string
}

export interface PebbleMetrics {
  compactionCount: number
  compactionEstimatedDebt: number
  compactionInProgressBytes: number
  compactionNumInProgress: number
  compactionMarkedFiles: number
}

export interface BloomStatus {
  enabled: boolean
  initialized: boolean
  bloomInitElapsedTime: string
}

export interface EtherBalance {
  accountAddress: string
  balanceWei: string
}

export interface NativeTokenBalance {
  accountAddress: string
  balance: string
}

export interface IndexState {
  chainId: string
  lastBlockNum: number
  lastBlockHash: string
}

export interface IndexedBlock {
  blockNumber: number
  blockShortHash: string
}

export interface TxnInfo {
  from: string
  to: string
  value: string
}

export interface EventLog {
  id: number
  uid: string
  type: EventLogType
  blockNumber: number
  blockHash: string
  parentBlockHash: string
  contractAddress: string
  contractType: ContractType
  txnHash: string
  txnIndex: number
  txnLogIndex: number
  logDataType: EventLogDataType
  ts: string
  txnInfo?: TxnInfo
  rawLog?: { [key: string]: any }
  event?: EventDecoded
}

export interface EventDecoded {
  topicHash: string
  eventSig: string
  types: Array<string>
  names: Array<string>
  values: Array<string>
}

export interface TokenBalance {
  contractType: ContractType
  contractAddress: string
  accountAddress: string
  tokenID?: string
  balance: string
  blockHash: string
  blockNumber: number
  chainId: number
  uniqueCollectibles: string
  isSummary: boolean
  contractInfo?: ContractInfo
  tokenMetadata?: TokenMetadata
}

export interface OrderbookOrder {
  orderId: string
  tokenContract: string
  tokenId: string
  isListing: boolean
  quantity: string
  quantityRemaining: string
  currencyAddress: string
  pricePerToken: string
  expiry: string
  orderStatus: OrderStatus
  createdBy: string
  blockNumber: number
  orderbookContractAddress: string
  createdAt: number
}

export interface OrderbookOrderFilter {
  isListing?: boolean
  userAddresses?: Array<string>
  tokenIds: Array<string>
  excludeUserAddresses?: Array<string>
  afterBlockNumber: number
  afterCreatedAt: number
  beforeExpiry: number
  userAddress?: string
  excludeUserAddress?: string
}

export interface TokenHistory {
  blockNumber: number
  blockHash: string
  accountAddress: string
  contractAddress: string
  contractType: ContractType
  fromAddress: string
  toAddress: string
  txnHash: string
  txnIndex: number
  txnLogIndex: number
  logData: string
  tokenIDs: string
  Amounts: string
  ts: string
}

export interface TokenSupply {
  tokenID: string
  supply: string
  chainId: number
  contractInfo?: ContractInfo
  tokenMetadata?: TokenMetadata
}

export interface Transaction {
  txnHash: string
  blockNumber: number
  blockHash: string
  chainId: number
  metaTxnID?: string
  transfers?: Array<TxnTransfer>
  timestamp: string
}

export interface TxnTransfer {
  transferType: TxnTransferType
  contractAddress: string
  contractType: ContractType
  from: string
  to: string
  tokenIds?: Array<string>
  amounts: Array<string>
  logIndex: number
  contractInfo?: ContractInfo
  tokenMetadata?: { [key: string]: TokenMetadata }
}

export interface TransactionHistoryFilter {
  accountAddress?: string
  contractAddress?: string
  accountAddresses?: Array<string>
  contractAddresses?: Array<string>
  transactionHashes?: Array<string>
  metaTransactionIDs?: Array<string>
  fromBlock?: number
  toBlock?: number
  tokenID?: string
}

export interface TransactionFilter {
  txnHash?: string
  from?: string
  to?: string
  contractAddress?: string
  event?: string
}

export interface TransactionReceipt {
  txnHash: string
  txnStatus: TransactionStatus
  txnIndex: number
  txnType: TransactionType
  blockHash: string
  blockNumber: number
  gasUsed: number
  effectiveGasPrice: string
  from: string
  to: string
  logs: Array<TransactionLog>
  final: boolean
  reorged: boolean
}

export interface TransactionLog {
  contractAddress: string
  topics: Array<string>
  data: string
  index: number
}

export interface TokenIDRange {
  start: string
  end: string
}

export interface Page {
  page?: number
  column?: string
  before?: any
  after?: any
  sort?: Array<SortBy>
  pageSize?: number
  more?: boolean
}

export interface SortBy {
  column: string
  order: SortOrder
}

export interface WebhookListener {
  id: number
  projectID: number
  url: string
  filters: EventFilter
  name: string
  updatedAt: string
  active: boolean
}

export interface EventFilter {
  events?: Array<string>
  contractAddresses?: Array<string>
  accounts?: Array<string>
  tokenIDs?: Array<string>
}

export interface TokenBalanceFilter {
  contractAddress: string
  sinceBlockNumber: number
}

export interface MetadataOptions {
  verifiedOnly?: boolean
  unverifiedOnly?: boolean
  includeContracts?: Array<string>
}

export interface TokenBalancesFilter {
  accountAddresses: Array<string>
  contractStatus?: ContractVerificationStatus
  contractWhitelist?: Array<string>
  contractBlacklist?: Array<string>
}

export interface TokenBalancesByContractFilter {
  contractAddresses: Array<string>
  accountAddresses?: Array<string>
  contractStatus?: ContractVerificationStatus
}

export interface GatewayEtherBalance {
  chainId: number
  error: string
  result: EtherBalance
}

export interface GatewayNativeTokenBalance {
  chainId: number
  error: string
  result: NativeTokenBalance
}

export interface GatewayTokenBalance {
  chainId: number
  error: string
  results: Array<TokenBalance>
}

export interface IndexerGateway {
  getNativeTokenBalance(
    args: GetNativeTokenBalanceArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetNativeTokenBalanceReturn>
  getTokenBalances(args: GetTokenBalancesArgs, headers?: object, signal?: AbortSignal): Promise<GetTokenBalancesReturn>
  getTokenBalancesSummary(
    args: GetTokenBalancesSummaryArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesSummaryReturn>
  getTokenBalancesDetails(
    args: GetTokenBalancesDetailsArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesDetailsReturn>
  getTokenBalancesByContract(
    args: GetTokenBalancesByContractArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesByContractReturn>
  getBalanceUpdates(args: GetBalanceUpdatesArgs, headers?: object, signal?: AbortSignal): Promise<GetBalanceUpdatesReturn>
  ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>
  version(headers?: object, signal?: AbortSignal): Promise<VersionReturn>
  runtimeStatus(headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn>
}

export interface GetNativeTokenBalanceArgs {
  chainIds?: Array<number>
  accountAddress?: string
}

export interface GetNativeTokenBalanceReturn {
  balances: Array<GatewayNativeTokenBalance>
}
export interface GetTokenBalancesArgs {
  chainIds?: Array<number>
  accountAddress?: string
  contractAddress?: string
  tokenID?: string
  includeMetadata?: boolean
  metadataOptions?: MetadataOptions
  includeCollectionTokens?: boolean
  page?: Page
}

export interface GetTokenBalancesReturn {
  page: Page
  balances: Array<GatewayTokenBalance>
}
export interface GetTokenBalancesSummaryArgs {
  chainIds?: Array<number>
  filter: TokenBalancesFilter
  omitMetadata?: boolean
  page?: Page
}

export interface GetTokenBalancesSummaryReturn {
  page: Page
  balances: Array<GatewayTokenBalance>
}
export interface GetTokenBalancesDetailsArgs {
  chainIds?: Array<number>
  filter: TokenBalancesFilter
  omitMetadata?: boolean
  page?: Page
}

export interface GetTokenBalancesDetailsReturn {
  page: Page
  balances: Array<GatewayTokenBalance>
}
export interface GetTokenBalancesByContractArgs {
  chainIds?: Array<number>
  filter: TokenBalancesByContractFilter
  omitMetadata?: boolean
  page?: Page
}

export interface GetTokenBalancesByContractReturn {
  page: Page
  balances: Array<GatewayTokenBalance>
}
export interface GetBalanceUpdatesArgs {
  chainIds?: Array<number>
  contractAddress: string
  lastBlockNumber: number
  lastBlockHash?: string
  page?: Page
}

export interface GetBalanceUpdatesReturn {
  page: Page
  balances: Array<GatewayTokenBalance>
}
export interface PingArgs {}

export interface PingReturn {
  status: boolean
}
export interface VersionArgs {}

export interface VersionReturn {
  version: Version
}
export interface RuntimeStatusArgs {}

export interface RuntimeStatusReturn {
  status: RuntimeStatus
}

//
// Client
//
export class IndexerGateway implements IndexerGateway {
  protected hostname: string
  protected fetch: Fetch
  protected path = '/rpc/IndexerGateway/'

  constructor(hostname: string, fetch: Fetch) {
    this.hostname = hostname.replace(/\/*$/, '')
    this.fetch = (input: RequestInfo, init?: RequestInit) => fetch(input, init)
  }

  private url(name: string): string {
    return this.hostname + this.path + name
  }

  getNativeTokenBalance = (
    args: GetNativeTokenBalanceArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetNativeTokenBalanceReturn> => {
    return this.fetch(this.url('GetNativeTokenBalance'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            balances: <Array<GatewayNativeTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getTokenBalances = (args: GetTokenBalancesArgs, headers?: object, signal?: AbortSignal): Promise<GetTokenBalancesReturn> => {
    return this.fetch(this.url('GetTokenBalances'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            page: <Page>_data.page,
            balances: <Array<GatewayTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getTokenBalancesSummary = (
    args: GetTokenBalancesSummaryArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesSummaryReturn> => {
    return this.fetch(this.url('GetTokenBalancesSummary'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            page: <Page>_data.page,
            balances: <Array<GatewayTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getTokenBalancesDetails = (
    args: GetTokenBalancesDetailsArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesDetailsReturn> => {
    return this.fetch(this.url('GetTokenBalancesDetails'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            page: <Page>_data.page,
            balances: <Array<GatewayTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getTokenBalancesByContract = (
    args: GetTokenBalancesByContractArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetTokenBalancesByContractReturn> => {
    return this.fetch(this.url('GetTokenBalancesByContract'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            page: <Page>_data.page,
            balances: <Array<GatewayTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getBalanceUpdates = (args: GetBalanceUpdatesArgs, headers?: object, signal?: AbortSignal): Promise<GetBalanceUpdatesReturn> => {
    return this.fetch(this.url('GetBalanceUpdates'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            page: <Page>_data.page,
            balances: <Array<GatewayTokenBalance>>_data.balances
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  ping = (headers?: object, signal?: AbortSignal): Promise<PingReturn> => {
    return this.fetch(this.url('Ping'), createHTTPRequest({}, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            status: <boolean>_data.status
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  version = (headers?: object, signal?: AbortSignal): Promise<VersionReturn> => {
    return this.fetch(this.url('Version'), createHTTPRequest({}, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            version: <Version>_data.version
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  runtimeStatus = (headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn> => {
    return this.fetch(this.url('RuntimeStatus'), createHTTPRequest({}, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            status: <RuntimeStatus>_data.status
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }
}

const createHTTPRequest = (body: object = {}, headers: object = {}, signal: AbortSignal | null = null): object => {
  const reqHeaders: { [key: string]: string } = { ...headers, 'Content-Type': 'application/json' }
  reqHeaders[WebrpcHeader] = WebrpcHeaderValue

  return {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body || {}),
    signal
  }
}

const buildResponse = (res: Response): Promise<any> => {
  return res.text().then(text => {
    let data
    try {
      data = JSON.parse(text)
    } catch (error) {
      let message = ''
      if (error instanceof Error) {
        message = error.message
      }
      throw WebrpcBadResponseError.new({
        status: res.status,
        cause: `JSON.parse(): ${message}: response text: ${text}`
      })
    }
    if (!res.ok) {
      const code: number = typeof data.code === 'number' ? data.code : 0
      throw (webrpcErrorByCode[code] || WebrpcError).new(data)
    }
    return data
  })
}

//
// Errors
//

export class WebrpcError extends Error {
  name: string
  code: number
  message: string
  status: number
  cause?: string

  /** @deprecated Use message instead of msg. Deprecated in webrpc v0.11.0. */
  msg: string

  constructor(name: string, code: number, message: string, status: number, cause?: string) {
    super(message)
    this.name = name || 'WebrpcError'
    this.code = typeof code === 'number' ? code : 0
    this.message = message || `endpoint error ${this.code}`
    this.msg = this.message
    this.status = typeof status === 'number' ? status : 0
    this.cause = cause
    Object.setPrototypeOf(this, WebrpcError.prototype)
  }

  static new(payload: any): WebrpcError {
    return new this(payload.error, payload.code, payload.message || payload.msg, payload.status, payload.cause)
  }
}

// Webrpc errors

export class WebrpcEndpointError extends WebrpcError {
  constructor(
    name: string = 'WebrpcEndpoint',
    code: number = 0,
    message: string = 'endpoint error',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcEndpointError.prototype)
  }
}

export class WebrpcRequestFailedError extends WebrpcError {
  constructor(
    name: string = 'WebrpcRequestFailed',
    code: number = -1,
    message: string = 'request failed',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcRequestFailedError.prototype)
  }
}

export class WebrpcBadRouteError extends WebrpcError {
  constructor(
    name: string = 'WebrpcBadRoute',
    code: number = -2,
    message: string = 'bad route',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcBadRouteError.prototype)
  }
}

export class WebrpcBadMethodError extends WebrpcError {
  constructor(
    name: string = 'WebrpcBadMethod',
    code: number = -3,
    message: string = 'bad method',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcBadMethodError.prototype)
  }
}

export class WebrpcBadRequestError extends WebrpcError {
  constructor(
    name: string = 'WebrpcBadRequest',
    code: number = -4,
    message: string = 'bad request',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcBadRequestError.prototype)
  }
}

export class WebrpcBadResponseError extends WebrpcError {
  constructor(
    name: string = 'WebrpcBadResponse',
    code: number = -5,
    message: string = 'bad response',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcBadResponseError.prototype)
  }
}

export class WebrpcServerPanicError extends WebrpcError {
  constructor(
    name: string = 'WebrpcServerPanic',
    code: number = -6,
    message: string = 'server panic',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcServerPanicError.prototype)
  }
}

export class WebrpcInternalErrorError extends WebrpcError {
  constructor(
    name: string = 'WebrpcInternalError',
    code: number = -7,
    message: string = 'internal error',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcInternalErrorError.prototype)
  }
}

export class WebrpcClientDisconnectedError extends WebrpcError {
  constructor(
    name: string = 'WebrpcClientDisconnected',
    code: number = -8,
    message: string = 'client disconnected',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcClientDisconnectedError.prototype)
  }
}

export class WebrpcStreamLostError extends WebrpcError {
  constructor(
    name: string = 'WebrpcStreamLost',
    code: number = -9,
    message: string = 'stream lost',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcStreamLostError.prototype)
  }
}

export class WebrpcStreamFinishedError extends WebrpcError {
  constructor(
    name: string = 'WebrpcStreamFinished',
    code: number = -10,
    message: string = 'stream finished',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcStreamFinishedError.prototype)
  }
}

// Schema errors

export class UnauthorizedError extends WebrpcError {
  constructor(
    name: string = 'Unauthorized',
    code: number = 1000,
    message: string = 'Unauthorized access',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

export class PermissionDeniedError extends WebrpcError {
  constructor(
    name: string = 'PermissionDenied',
    code: number = 1001,
    message: string = 'Permission denied',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, PermissionDeniedError.prototype)
  }
}

export class SessionExpiredError extends WebrpcError {
  constructor(
    name: string = 'SessionExpired',
    code: number = 1002,
    message: string = 'Session expired',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, SessionExpiredError.prototype)
  }
}

export class MethodNotFoundError extends WebrpcError {
  constructor(
    name: string = 'MethodNotFound',
    code: number = 1003,
    message: string = 'Method not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, MethodNotFoundError.prototype)
  }
}

export class RequestConflictError extends WebrpcError {
  constructor(
    name: string = 'RequestConflict',
    code: number = 1004,
    message: string = 'Conflict with target resource',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, RequestConflictError.prototype)
  }
}

export class AbortedError extends WebrpcError {
  constructor(
    name: string = 'Aborted',
    code: number = 1005,
    message: string = 'Request aborted',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AbortedError.prototype)
  }
}

export class GeoblockedError extends WebrpcError {
  constructor(
    name: string = 'Geoblocked',
    code: number = 1006,
    message: string = 'Geoblocked region',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, GeoblockedError.prototype)
  }
}

export class RateLimitedError extends WebrpcError {
  constructor(
    name: string = 'RateLimited',
    code: number = 1007,
    message: string = 'Rate-limited. Please slow down.',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, RateLimitedError.prototype)
  }
}

export class ProjectNotFoundError extends WebrpcError {
  constructor(
    name: string = 'ProjectNotFound',
    code: number = 1100,
    message: string = 'Project not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ProjectNotFoundError.prototype)
  }
}

export class AccessKeyNotFoundError extends WebrpcError {
  constructor(
    name: string = 'AccessKeyNotFound',
    code: number = 1101,
    message: string = 'Access key not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AccessKeyNotFoundError.prototype)
  }
}

export class AccessKeyMismatchError extends WebrpcError {
  constructor(
    name: string = 'AccessKeyMismatch',
    code: number = 1102,
    message: string = 'Access key mismatch',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AccessKeyMismatchError.prototype)
  }
}

export class InvalidOriginError extends WebrpcError {
  constructor(
    name: string = 'InvalidOrigin',
    code: number = 1103,
    message: string = 'Invalid origin for Access Key',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InvalidOriginError.prototype)
  }
}

export class InvalidServiceError extends WebrpcError {
  constructor(
    name: string = 'InvalidService',
    code: number = 1104,
    message: string = 'Service not enabled for Access key',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InvalidServiceError.prototype)
  }
}

export class UnauthorizedUserError extends WebrpcError {
  constructor(
    name: string = 'UnauthorizedUser',
    code: number = 1105,
    message: string = 'Unauthorized user',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, UnauthorizedUserError.prototype)
  }
}

export class QuotaExceededError extends WebrpcError {
  constructor(
    name: string = 'QuotaExceeded',
    code: number = 1200,
    message: string = 'Quota exceeded',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, QuotaExceededError.prototype)
  }
}

export class RateLimitError extends WebrpcError {
  constructor(
    name: string = 'RateLimit',
    code: number = 1201,
    message: string = 'Rate limit exceeded',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

export class NoDefaultKeyError extends WebrpcError {
  constructor(
    name: string = 'NoDefaultKey',
    code: number = 1300,
    message: string = 'No default access key found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, NoDefaultKeyError.prototype)
  }
}

export class MaxAccessKeysError extends WebrpcError {
  constructor(
    name: string = 'MaxAccessKeys',
    code: number = 1301,
    message: string = 'Access keys limit reached',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, MaxAccessKeysError.prototype)
  }
}

export class AtLeastOneKeyError extends WebrpcError {
  constructor(
    name: string = 'AtLeastOneKey',
    code: number = 1302,
    message: string = 'You need at least one Access Key',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AtLeastOneKeyError.prototype)
  }
}

export class TimeoutError extends WebrpcError {
  constructor(
    name: string = 'Timeout',
    code: number = 1900,
    message: string = 'Request timed out',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}

export class InvalidArgumentError extends WebrpcError {
  constructor(
    name: string = 'InvalidArgument',
    code: number = 2001,
    message: string = 'Invalid argument',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InvalidArgumentError.prototype)
  }
}

export class UnavailableError extends WebrpcError {
  constructor(
    name: string = 'Unavailable',
    code: number = 2002,
    message: string = 'Unavailable resource',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, UnavailableError.prototype)
  }
}

export class QueryFailedError extends WebrpcError {
  constructor(
    name: string = 'QueryFailed',
    code: number = 2003,
    message: string = 'Query failed',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, QueryFailedError.prototype)
  }
}

export class ResourceExhaustedError extends WebrpcError {
  constructor(
    name: string = 'ResourceExhausted',
    code: number = 2004,
    message: string = 'Resource exhausted',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ResourceExhaustedError.prototype)
  }
}

export class NotFoundError extends WebrpcError {
  constructor(
    name: string = 'NotFound',
    code: number = 3000,
    message: string = 'Resource not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class MetadataCallFailedError extends WebrpcError {
  constructor(
    name: string = 'MetadataCallFailed',
    code: number = 3003,
    message: string = 'Metadata service call failed',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, MetadataCallFailedError.prototype)
  }
}

export enum errors {
  WebrpcEndpoint = 'WebrpcEndpoint',
  WebrpcRequestFailed = 'WebrpcRequestFailed',
  WebrpcBadRoute = 'WebrpcBadRoute',
  WebrpcBadMethod = 'WebrpcBadMethod',
  WebrpcBadRequest = 'WebrpcBadRequest',
  WebrpcBadResponse = 'WebrpcBadResponse',
  WebrpcServerPanic = 'WebrpcServerPanic',
  WebrpcInternalError = 'WebrpcInternalError',
  WebrpcClientDisconnected = 'WebrpcClientDisconnected',
  WebrpcStreamLost = 'WebrpcStreamLost',
  WebrpcStreamFinished = 'WebrpcStreamFinished',
  Unauthorized = 'Unauthorized',
  PermissionDenied = 'PermissionDenied',
  SessionExpired = 'SessionExpired',
  MethodNotFound = 'MethodNotFound',
  RequestConflict = 'RequestConflict',
  Aborted = 'Aborted',
  Geoblocked = 'Geoblocked',
  RateLimited = 'RateLimited',
  ProjectNotFound = 'ProjectNotFound',
  AccessKeyNotFound = 'AccessKeyNotFound',
  AccessKeyMismatch = 'AccessKeyMismatch',
  InvalidOrigin = 'InvalidOrigin',
  InvalidService = 'InvalidService',
  UnauthorizedUser = 'UnauthorizedUser',
  QuotaExceeded = 'QuotaExceeded',
  RateLimit = 'RateLimit',
  NoDefaultKey = 'NoDefaultKey',
  MaxAccessKeys = 'MaxAccessKeys',
  AtLeastOneKey = 'AtLeastOneKey',
  Timeout = 'Timeout',
  InvalidArgument = 'InvalidArgument',
  Unavailable = 'Unavailable',
  QueryFailed = 'QueryFailed',
  ResourceExhausted = 'ResourceExhausted',
  NotFound = 'NotFound',
  MetadataCallFailed = 'MetadataCallFailed'
}

const webrpcErrorByCode: { [code: number]: any } = {
  [0]: WebrpcEndpointError,
  [-1]: WebrpcRequestFailedError,
  [-2]: WebrpcBadRouteError,
  [-3]: WebrpcBadMethodError,
  [-4]: WebrpcBadRequestError,
  [-5]: WebrpcBadResponseError,
  [-6]: WebrpcServerPanicError,
  [-7]: WebrpcInternalErrorError,
  [-8]: WebrpcClientDisconnectedError,
  [-9]: WebrpcStreamLostError,
  [-10]: WebrpcStreamFinishedError,
  [1000]: UnauthorizedError,
  [1001]: PermissionDeniedError,
  [1002]: SessionExpiredError,
  [1003]: MethodNotFoundError,
  [1004]: RequestConflictError,
  [1005]: AbortedError,
  [1006]: GeoblockedError,
  [1007]: RateLimitedError,
  [1100]: ProjectNotFoundError,
  [1101]: AccessKeyNotFoundError,
  [1102]: AccessKeyMismatchError,
  [1103]: InvalidOriginError,
  [1104]: InvalidServiceError,
  [1105]: UnauthorizedUserError,
  [1200]: QuotaExceededError,
  [1201]: RateLimitError,
  [1300]: NoDefaultKeyError,
  [1301]: MaxAccessKeysError,
  [1302]: AtLeastOneKeyError,
  [1900]: TimeoutError,
  [2001]: InvalidArgumentError,
  [2002]: UnavailableError,
  [2003]: QueryFailedError,
  [2004]: ResourceExhaustedError,
  [3000]: NotFoundError,
  [3003]: MetadataCallFailedError
}

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>
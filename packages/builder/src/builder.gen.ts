/* eslint-disable */
// NOTE: this is just a subset of the builder api to scope down the
// surface area of the client.
//
// In the future we can include additional interfaces as needed.
export const WebrpcHeader = 'Webrpc'

export const WebrpcHeaderValue = 'webrpc@v0.22.1;gen-typescript@v0.16.2;sequence-builder@v0.1.0'

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.1.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = '461bc324d241f4df14fbf63268fde2cfe4873e3e'

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

export interface AudienceContact {
  id?: number
  audienceId: number
  name?: string
  address: string
  email?: string
  userIp?: string
  stage?: number
  provider?: string
  createdAt?: string
  updatedAt?: string
}

export interface AudienceRegistrationStatus {
  totalCount: number
}

export interface WalletProof {
  address: string
  message: string
  signature: string
  chainId: number
}

export interface Builder {
  ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>
  registerAudienceContact(
    args: RegisterAudienceContactArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<RegisterAudienceContactReturn>
  getRegisteredAudienceContact(
    args: GetRegisteredAudienceContactArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetRegisteredAudienceContactReturn>
  getAudienceRegistrationPublicStatus(
    args: GetAudienceRegistrationPublicStatusArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetAudienceRegistrationPublicStatusReturn>
  isAudienceContactRegistered(
    args: IsAudienceContactRegisteredArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<IsAudienceContactRegisteredReturn>
}

export interface PingArgs {}

export interface PingReturn {
  status: boolean
}

export interface RegisterAudienceContactArgs {
  projectId: number
  audienceId: number
  contact: AudienceContact
  walletProof: WalletProof
}

export interface RegisterAudienceContactReturn {
  ok: boolean
}
export interface GetRegisteredAudienceContactArgs {
  projectId: number
  audienceId: number
  walletProof: WalletProof
}

export interface GetRegisteredAudienceContactReturn {
  contact: AudienceContact
}
export interface GetAudienceRegistrationPublicStatusArgs {
  projectId: number
  audienceId: number
}

export interface GetAudienceRegistrationPublicStatusReturn {
  status: AudienceRegistrationStatus
}
export interface IsAudienceContactRegisteredArgs {
  projectId: number
  audienceId: number
  walletAddress: string
}

export interface IsAudienceContactRegisteredReturn {
  registered: boolean
}

//
// Client
//
export class Builder implements Builder {
  protected hostname: string
  protected fetch: Fetch
  protected path = '/rpc/Builder/'

  constructor(hostname: string, fetch: Fetch) {
    this.hostname = hostname.replace(/\/*$/, '')
    this.fetch = (input: RequestInfo, init?: RequestInit) => fetch(input, init)
  }

  private url(name: string): string {
    return this.hostname + this.path + name
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

  registerAudienceContact = (
    args: RegisterAudienceContactArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<RegisterAudienceContactReturn> => {
    return this.fetch(this.url('RegisterAudienceContact'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            ok: <boolean>_data.ok
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getRegisteredAudienceContact = (
    args: GetRegisteredAudienceContactArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetRegisteredAudienceContactReturn> => {
    return this.fetch(this.url('GetRegisteredAudienceContact'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            contact: <AudienceContact>_data.contact
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  getAudienceRegistrationPublicStatus = (
    args: GetAudienceRegistrationPublicStatusArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<GetAudienceRegistrationPublicStatusReturn> => {
    return this.fetch(this.url('GetAudienceRegistrationPublicStatus'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            status: <AudienceRegistrationStatus>_data.status
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  isAudienceContactRegistered = (
    args: IsAudienceContactRegisteredArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<IsAudienceContactRegisteredReturn> => {
    return this.fetch(this.url('IsAudienceContactRegistered'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            registered: <boolean>_data.registered
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

export class ServiceDisabledError extends WebrpcError {
  constructor(
    name: string = 'ServiceDisabled',
    code: number = 1005,
    message: string = 'Service disabled',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ServiceDisabledError.prototype)
  }
}

export class TimeoutError extends WebrpcError {
  constructor(
    name: string = 'Timeout',
    code: number = 2000,
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

export class UserNotFoundError extends WebrpcError {
  constructor(
    name: string = 'UserNotFound',
    code: number = 3001,
    message: string = 'User not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, UserNotFoundError.prototype)
  }
}

export class ProjectNotFoundError extends WebrpcError {
  constructor(
    name: string = 'ProjectNotFound',
    code: number = 3002,
    message: string = 'Project not found',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ProjectNotFoundError.prototype)
  }
}

export class AlreadyCollaboratorError extends WebrpcError {
  constructor(
    name: string = 'AlreadyCollaborator',
    code: number = 4001,
    message: string = 'Already a collaborator',
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AlreadyCollaboratorError.prototype)
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
  ServiceDisabled = 'ServiceDisabled',
  Timeout = 'Timeout',
  InvalidArgument = 'InvalidArgument',
  NotFound = 'NotFound',
  UserNotFound = 'UserNotFound',
  ProjectNotFound = 'ProjectNotFound'
}

export enum WebrpcErrorCodes {
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
  ServiceDisabled = 1005,
  Timeout = 2000,
  InvalidArgument = 2001,
  NotFound = 3000,
  UserNotFound = 3001,
  ProjectNotFound = 3002
}

export const webrpcErrorByCode: { [code: number]: any } = {
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
  [1005]: ServiceDisabledError,
  [2000]: TimeoutError,
  [2001]: InvalidArgumentError,
  [3000]: NotFoundError,
  [3001]: UserNotFoundError,
  [3002]: ProjectNotFoundError
}

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

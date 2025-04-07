/* eslint-disable */
// sequence-guard v0.4.0 776b307c2145ac7a994eec63240acae042c96067
// --
// Code generated by webrpc-gen@v0.25.3 with typescript generator. DO NOT EDIT.
//
// webrpc-gen -schema=guard.ridl -target=typescript -client -out=./clients/guard.gen.ts

export const WebrpcHeader = 'Webrpc'

export const WebrpcHeaderValue = 'webrpc@v0.25.3;gen-typescript@v0.17.0;sequence-guard@v0.4.0'

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.4.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = '776b307c2145ac7a994eec63240acae042c96067'

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

  const [_, webrpcGenVersion] = versions[0]!.split('@')
  const [codeGenName, codeGenVersion] = versions[1]!.split('@')
  const [schemaName, schemaVersion] = versions[2]!.split('@')

  return {
    webrpcGenVersion: webrpcGenVersion ?? '',
    codeGenName: codeGenName ?? '',
    codeGenVersion: codeGenVersion ?? '',
    schemaName: schemaName ?? '',
    schemaVersion: schemaVersion ?? ''
  }
}

//
// Types
//

export interface Version {
  webrpcVersion: string
  schemaVersion: string
  schemaHash: string
  appVersion: string
}

export interface RuntimeStatus {
  healthOK: boolean
  startTime: string
  uptime: number
  ver: string
  branch: string
  commitHash: string
}

export interface WalletConfig {
  address: string
  content: string
}

export interface WalletSigner {
  address: string
  weight: number
}

export interface SignRequest {
  chainId: number
  msg: string
  auxData: string
}

export interface OwnershipProof {
  wallet: string
  timestamp: number
  signer: string
  signature: string
}

export interface AuthToken {
  id: string
  token: string
}

export interface RecoveryCode {
  code: string
  used: boolean
}

export interface Guard {
  ping(headers?: object, signal?: AbortSignal): Promise<PingReturn>
  version(headers?: object, signal?: AbortSignal): Promise<VersionReturn>
  runtimeStatus(headers?: object, signal?: AbortSignal): Promise<RuntimeStatusReturn>
  getSignerConfig(args: GetSignerConfigArgs, headers?: object, signal?: AbortSignal): Promise<GetSignerConfigReturn>
  /**
   * Called by sequence.app when the user signs in, and signs messages/transactions/migrations.
   * Requires a valid 2FA token if enabled.
   */
  sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>
  signWith(args: SignWithArgs, headers?: object, signal?: AbortSignal): Promise<SignWithReturn>
  /**
   * Internal use only.
   * Only ever needs to be called once per chain.
   * Signs a preconfigured payload that the caller has no control over.
   */
  patch(args: PatchArgs, headers?: object, signal?: AbortSignal): Promise<PatchReturn>
  /**
   * Called by sequence.app when it needs to check the user's 2FA.
   * This happens during sign in, before signing messages and transactions, and when configuring 2FA.
   * Requires either a valid JWT or a signature by one of the wallet's signers.
   */
  authMethods(args: AuthMethodsArgs, headers?: object, signal?: AbortSignal): Promise<AuthMethodsReturn>
  /**
   * Not currently called. Requires both a JWT and a wallet signature.
   */
  setPIN(args: SetPINArgs, headers?: object, signal?: AbortSignal): Promise<SetPINReturn>
  /**
   * Not currently called. Requires both a JWT and a wallet signature.
   */
  resetPIN(args: ResetPINArgs, headers?: object, signal?: AbortSignal): Promise<ResetPINReturn>
  /**
   * Called by sequence.app when the user configures their 2FA.
   * Requires both a JWT and a wallet signature.
   */
  createTOTP(args: CreateTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CreateTOTPReturn>
  /**
   * Called by sequence.app when the user configures their 2FA.
   * Requires both a JWT and a wallet signature.
   */
  commitTOTP(args: CommitTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CommitTOTPReturn>
  /**
   * Called by sequence.app when the user configures their 2FA.
   * Requires both a JWT and a wallet signature.
   */
  resetTOTP(args: ResetTOTPArgs, headers?: object, signal?: AbortSignal): Promise<ResetTOTPReturn>
  /**
   * Called by sequence.app when the user uses a recovery code.
   * Requires either a valid JWT or a signature by one of the wallet's signers.
   */
  reset2FA(args: Reset2FAArgs, headers?: object, signal?: AbortSignal): Promise<Reset2FAReturn>
  /**
   * Called by sequence.app when the user is viewing their recovery codes.
   * Requires both a JWT and a wallet signature.
   */
  recoveryCodes(args: RecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<RecoveryCodesReturn>
  /**
   * Called by sequence.app when the user is viewing their recovery codes.
   * Requires both a JWT and a wallet signature.
   */
  resetRecoveryCodes(args: ResetRecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<ResetRecoveryCodesReturn>
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
export interface GetSignerConfigArgs {
  signer: string
}

export interface GetSignerConfigReturn {
  signerConfig: WalletConfig
}
export interface SignArgs {
  request: SignRequest
  token?: AuthToken
}

export interface SignReturn {
  sig: string
}
export interface SignWithArgs {
  signer: string
  request: SignRequest
  token?: AuthToken
}

export interface SignWithReturn {
  sig: string
}
export interface PatchArgs {
  signer: string
  chainId: number
  secret: string
}

export interface PatchReturn {
  txs: any
}
export interface AuthMethodsArgs {
  proof?: OwnershipProof
}

export interface AuthMethodsReturn {
  methods: Array<string>
  active: boolean
}
export interface SetPINArgs {
  pin: string
  timestamp: number
  signature: string
}

export interface SetPINReturn {}
export interface ResetPINArgs {
  timestamp: number
  signature: string
}

export interface ResetPINReturn {}
export interface CreateTOTPArgs {
  timestamp: number
  signature: string
}

export interface CreateTOTPReturn {
  uri: string
}
export interface CommitTOTPArgs {
  token: string
}

export interface CommitTOTPReturn {
  codes: Array<RecoveryCode>
}
export interface ResetTOTPArgs {
  timestamp: number
  signature: string
}

export interface ResetTOTPReturn {}
export interface Reset2FAArgs {
  code: string
  proof?: OwnershipProof
}

export interface Reset2FAReturn {}
export interface RecoveryCodesArgs {
  timestamp: number
  signature: string
}

export interface RecoveryCodesReturn {
  codes: Array<RecoveryCode>
}
export interface ResetRecoveryCodesArgs {
  timestamp: number
  signature: string
}

export interface ResetRecoveryCodesReturn {
  codes: Array<RecoveryCode>
}

//
// Client
//
export class Guard implements Guard {
  protected hostname: string
  protected fetch: Fetch
  protected path = '/rpc/Guard/'

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

  getSignerConfig = (args: GetSignerConfigArgs, headers?: object, signal?: AbortSignal): Promise<GetSignerConfigReturn> => {
    return this.fetch(this.url('GetSignerConfig'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            signerConfig: <WalletConfig>_data.signerConfig
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  sign = (args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn> => {
    return this.fetch(this.url('Sign'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            sig: <string>_data.sig
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  signWith = (args: SignWithArgs, headers?: object, signal?: AbortSignal): Promise<SignWithReturn> => {
    return this.fetch(this.url('SignWith'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            sig: <string>_data.sig
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  patch = (args: PatchArgs, headers?: object, signal?: AbortSignal): Promise<PatchReturn> => {
    return this.fetch(this.url('Patch'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            txs: <any>_data.txs
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  authMethods = (args: AuthMethodsArgs, headers?: object, signal?: AbortSignal): Promise<AuthMethodsReturn> => {
    return this.fetch(this.url('AuthMethods'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            methods: <Array<string>>_data.methods,
            active: <boolean>_data.active
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  setPIN = (args: SetPINArgs, headers?: object, signal?: AbortSignal): Promise<SetPINReturn> => {
    return this.fetch(this.url('SetPIN'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {}
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  resetPIN = (args: ResetPINArgs, headers?: object, signal?: AbortSignal): Promise<ResetPINReturn> => {
    return this.fetch(this.url('ResetPIN'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {}
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  createTOTP = (args: CreateTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CreateTOTPReturn> => {
    return this.fetch(this.url('CreateTOTP'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            uri: <string>_data.uri
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  commitTOTP = (args: CommitTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CommitTOTPReturn> => {
    return this.fetch(this.url('CommitTOTP'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            codes: <Array<RecoveryCode>>_data.codes
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  resetTOTP = (args: ResetTOTPArgs, headers?: object, signal?: AbortSignal): Promise<ResetTOTPReturn> => {
    return this.fetch(this.url('ResetTOTP'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {}
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  reset2FA = (args: Reset2FAArgs, headers?: object, signal?: AbortSignal): Promise<Reset2FAReturn> => {
    return this.fetch(this.url('Reset2FA'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {}
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  recoveryCodes = (args: RecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<RecoveryCodesReturn> => {
    return this.fetch(this.url('RecoveryCodes'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            codes: <Array<RecoveryCode>>_data.codes
          }
        })
      },
      error => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      }
    )
  }

  resetRecoveryCodes = (
    args: ResetRecoveryCodesArgs,
    headers?: object,
    signal?: AbortSignal
  ): Promise<ResetRecoveryCodesReturn> => {
    return this.fetch(this.url('ResetRecoveryCodes'), createHTTPRequest(args, headers, signal)).then(
      res => {
        return buildResponse(res).then(_data => {
          return {
            codes: <Array<RecoveryCode>>_data.codes
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
    message: string = `endpoint error`,
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
    message: string = `request failed`,
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
    message: string = `bad route`,
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
    message: string = `bad method`,
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
    message: string = `bad request`,
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
    message: string = `bad response`,
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
    message: string = `server panic`,
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
    message: string = `internal error`,
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
    message: string = `client disconnected`,
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
    message: string = `stream lost`,
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
    message: string = `stream finished`,
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
    message: string = `Unauthorized access`,
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
    message: string = `Permission denied`,
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
    message: string = `Session expired`,
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
    message: string = `Method not found`,
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
    message: string = `Conflict with target resource`,
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
    message: string = `Request aborted`,
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
    message: string = `Geoblocked region`,
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
    message: string = `Rate-limited. Please slow down.`,
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, RateLimitedError.prototype)
  }
}

export class InvalidArgumentError extends WebrpcError {
  constructor(
    name: string = 'InvalidArgument',
    code: number = 2001,
    message: string = `Invalid argument`,
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
    message: string = `Unavailable resource`,
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
    message: string = `Query failed`,
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, QueryFailedError.prototype)
  }
}

export class ValidationFailedError extends WebrpcError {
  constructor(
    name: string = 'ValidationFailed',
    code: number = 2004,
    message: string = `Validation Failed`,
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ValidationFailedError.prototype)
  }
}

export class NotFoundError extends WebrpcError {
  constructor(
    name: string = 'NotFound',
    code: number = 3000,
    message: string = `Resource not found`,
    status: number = 0,
    cause?: string
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, NotFoundError.prototype)
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
  InvalidArgument = 'InvalidArgument',
  Unavailable = 'Unavailable',
  QueryFailed = 'QueryFailed',
  ValidationFailed = 'ValidationFailed',
  NotFound = 'NotFound'
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
  Aborted = 1005,
  Geoblocked = 1006,
  RateLimited = 1007,
  InvalidArgument = 2001,
  Unavailable = 2002,
  QueryFailed = 2003,
  ValidationFailed = 2004,
  NotFound = 3000
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
  [1005]: AbortedError,
  [1006]: GeoblockedError,
  [1007]: RateLimitedError,
  [2001]: InvalidArgumentError,
  [2002]: UnavailableError,
  [2003]: QueryFailedError,
  [2004]: ValidationFailedError,
  [3000]: NotFoundError
}

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

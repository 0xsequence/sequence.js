/* eslint-disable */
// sequence-guard v0.4.0 12059311f086716f467356ed38189f565d5f172a
// --
// Code generated by webrpc-gen@v0.18.6 with typescript generator. DO NOT EDIT.
//
// webrpc-gen -schema=guard.ridl -target=typescript -client -out=./clients/guard.gen.ts

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.4.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = '12059311f086716f467356ed38189f565d5f172a'

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
  sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>
  signWith(args: SignWithArgs, headers?: object, signal?: AbortSignal): Promise<SignWithReturn>
  authMethods(args: AuthMethodsArgs, headers?: object, signal?: AbortSignal): Promise<AuthMethodsReturn>
  setPIN(args: SetPINArgs, headers?: object, signal?: AbortSignal): Promise<SetPINReturn>
  resetPIN(args: ResetPINArgs, headers?: object, signal?: AbortSignal): Promise<ResetPINReturn>
  createTOTP(args: CreateTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CreateTOTPReturn>
  commitTOTP(args: CommitTOTPArgs, headers?: object, signal?: AbortSignal): Promise<CommitTOTPReturn>
  resetTOTP(args: ResetTOTPArgs, headers?: object, signal?: AbortSignal): Promise<ResetTOTPReturn>
  reset2FA(args: Reset2FAArgs, headers?: object, signal?: AbortSignal): Promise<Reset2FAReturn>
  recoveryCodes(args: RecoveryCodesArgs, headers?: object, signal?: AbortSignal): Promise<RecoveryCodesReturn>
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
    this.hostname = hostname
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
  return {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
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

export class ValidationFailedError extends WebrpcError {
  constructor(
    name: string = 'ValidationFailed',
    code: number = 2004,
    message: string = 'Validation Failed',
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
    message: string = 'Resource not found',
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
  SessionExpired = 'SessionExpired',
  Aborted = 'Aborted',
  InvalidArgument = 'InvalidArgument',
  Unavailable = 'Unavailable',
  QueryFailed = 'QueryFailed',
  ValidationFailed = 'ValidationFailed',
  NotFound = 'NotFound'
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
  [1002]: SessionExpiredError,
  [1005]: AbortedError,
  [2001]: InvalidArgumentError,
  [2002]: UnavailableError,
  [2003]: QueryFailedError,
  [2004]: ValidationFailedError,
  [3000]: NotFoundError
}

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

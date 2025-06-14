/* eslint-disable */
// identity-instrument v0.1.0 f482d220692b4c5e41797f4e8dddb70dab930ed3
// --
// Code generated by webrpc-gen@v0.23.1 with typescript generator. DO NOT EDIT.
//
// webrpc-gen -schema=identity-instrument.ridl -target=typescript -client -out=./clients/identity-instrument.gen.ts

export const WebrpcHeader = 'Webrpc'

export const WebrpcHeaderValue = 'webrpc@v0.23.1;gen-typescript@v0.16.3;identity-instrument@v0.1.0'

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.1.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = 'f482d220692b4c5e41797f4e8dddb70dab930ed3'

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
      schemaVersion: '',
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
      schemaVersion: '',
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
    schemaVersion: schemaVersion ?? '',
  }
}

//
// Types
//

export enum KeyType {
  Secp256k1 = 'Secp256k1',
  Secp256r1 = 'Secp256r1',
}

export enum IdentityType {
  Guest = 'Guest',
  Email = 'Email',
  OIDC = 'OIDC',
}

export enum AuthMode {
  Guest = 'Guest',
  OTP = 'OTP',
  IDToken = 'IDToken',
  AccessToken = 'AccessToken',
  AuthCode = 'AuthCode',
  AuthCodePKCE = 'AuthCodePKCE',
}

export interface CommitVerifierParams {
  scope?: string
  authKey: Key
  identityType: IdentityType
  authMode: AuthMode
  metadata: { [key: string]: string }
  handle?: string
  signer?: Key
}

export interface CompleteAuthParams {
  scope?: string
  authKey: Key
  identityType: IdentityType
  signerType: KeyType
  authMode: AuthMode
  verifier: string
  answer: string
}

export interface SignParams {
  scope?: string
  signer: Key
  digest: string
  authKey: Key
  signature: string
}

export interface Identity {
  type: IdentityType
  issuer: string
  subject: string
  email: string
}

export interface Key {
  keyType: KeyType
  address: string
}

export interface AuthID {
  scope: string
  authMode: AuthMode
  identityType: IdentityType
  verifier: string
}

export interface AuthKeyData {
  scope: string
  authKey: string
  signer: string
  expiry: string
}

export interface SignerData {
  scope: string
  identity: Identity
  keyType: KeyType
  privateKey: string
}

export interface AuthCommitmentData {
  scope: string
  authKey: string
  authMode: AuthMode
  identityType: IdentityType
  handle: string
  signer: string
  challenge: string
  answer: string
  metadata: { [key: string]: string }
  attempts: number
  expiry: string
}

export interface IdentityInstrument {
  commitVerifier(args: CommitVerifierArgs, headers?: object, signal?: AbortSignal): Promise<CommitVerifierReturn>
  completeAuth(args: CompleteAuthArgs, headers?: object, signal?: AbortSignal): Promise<CompleteAuthReturn>
  sign(args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn>
}

export interface CommitVerifierArgs {
  params: CommitVerifierParams
}

export interface CommitVerifierReturn {
  verifier: string
  loginHint: string
  challenge: string
}
export interface CompleteAuthArgs {
  params: CompleteAuthParams
}

export interface CompleteAuthReturn {
  signer: Key
  identity: Identity
}
export interface SignArgs {
  params: SignParams
}

export interface SignReturn {
  signature: string
}

//
// Client
//
export class IdentityInstrument implements IdentityInstrument {
  protected hostname: string
  protected fetch: Fetch
  protected path = '/rpc/IdentityInstrument/'

  constructor(hostname: string, fetch: Fetch) {
    this.hostname = hostname.replace(/\/*$/, '')
    this.fetch = (input: RequestInfo, init?: RequestInit) => fetch(input, init)
  }

  private url(name: string): string {
    return this.hostname + this.path + name
  }

  commitVerifier = (
    args: CommitVerifierArgs,
    headers?: object,
    signal?: AbortSignal,
  ): Promise<CommitVerifierReturn> => {
    return this.fetch(this.url('CommitVerifier'), createHTTPRequest(args, headers, signal)).then(
      (res) => {
        return buildResponse(res).then((_data) => {
          return {
            verifier: <string>_data.verifier,
            loginHint: <string>_data.loginHint,
            challenge: <string>_data.challenge,
          }
        })
      },
      (error) => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      },
    )
  }

  completeAuth = (args: CompleteAuthArgs, headers?: object, signal?: AbortSignal): Promise<CompleteAuthReturn> => {
    return this.fetch(this.url('CompleteAuth'), createHTTPRequest(args, headers, signal)).then(
      (res) => {
        return buildResponse(res).then((_data) => {
          return {
            signer: <Key>_data.signer,
            identity: <Identity>_data.identity,
          }
        })
      },
      (error) => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      },
    )
  }

  sign = (args: SignArgs, headers?: object, signal?: AbortSignal): Promise<SignReturn> => {
    return this.fetch(this.url('Sign'), createHTTPRequest(args, headers, signal)).then(
      (res) => {
        return buildResponse(res).then((_data) => {
          return {
            signature: <string>_data.signature,
          }
        })
      },
      (error) => {
        throw WebrpcRequestFailedError.new({ cause: `fetch(): ${error.message || ''}` })
      },
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
    signal,
  }
}

const buildResponse = (res: Response): Promise<any> => {
  return res.text().then((text) => {
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
        cause: `JSON.parse(): ${message}: response text: ${text}`,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
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
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, WebrpcStreamFinishedError.prototype)
  }
}

// Schema errors

export class InternalErrorError extends WebrpcError {
  constructor(
    name: string = 'InternalError',
    code: number = 7100,
    message: string = `Internal error`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InternalErrorError.prototype)
  }
}

export class EncryptionErrorError extends WebrpcError {
  constructor(
    name: string = 'EncryptionError',
    code: number = 7101,
    message: string = `Encryption error`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, EncryptionErrorError.prototype)
  }
}

export class DatabaseErrorError extends WebrpcError {
  constructor(
    name: string = 'DatabaseError',
    code: number = 7102,
    message: string = `Database error`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, DatabaseErrorError.prototype)
  }
}

export class DataIntegrityErrorError extends WebrpcError {
  constructor(
    name: string = 'DataIntegrityError',
    code: number = 7103,
    message: string = `Data integrity error`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, DataIntegrityErrorError.prototype)
  }
}

export class IdentityProviderErrorError extends WebrpcError {
  constructor(
    name: string = 'IdentityProviderError',
    code: number = 7104,
    message: string = `Identity provider error`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, IdentityProviderErrorError.prototype)
  }
}

export class InvalidRequestError extends WebrpcError {
  constructor(
    name: string = 'InvalidRequest',
    code: number = 7200,
    message: string = `The request was invalid`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InvalidRequestError.prototype)
  }
}

export class InvalidSignatureError extends WebrpcError {
  constructor(
    name: string = 'InvalidSignature',
    code: number = 7201,
    message: string = `The signature was invalid`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, InvalidSignatureError.prototype)
  }
}

export class KeyNotFoundError extends WebrpcError {
  constructor(
    name: string = 'KeyNotFound',
    code: number = 7202,
    message: string = `The authentication key was not found`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, KeyNotFoundError.prototype)
  }
}

export class KeyExpiredError extends WebrpcError {
  constructor(
    name: string = 'KeyExpired',
    code: number = 7203,
    message: string = `The authentication key expired`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, KeyExpiredError.prototype)
  }
}

export class SignerNotFoundError extends WebrpcError {
  constructor(
    name: string = 'SignerNotFound',
    code: number = 7204,
    message: string = `The signer was not found`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, SignerNotFoundError.prototype)
  }
}

export class ProofVerificationFailedError extends WebrpcError {
  constructor(
    name: string = 'ProofVerificationFailed',
    code: number = 7002,
    message: string = `The authentication proof could not be verified`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ProofVerificationFailedError.prototype)
  }
}

export class AnswerIncorrectError extends WebrpcError {
  constructor(
    name: string = 'AnswerIncorrect',
    code: number = 7003,
    message: string = `The provided answer is incorrect`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, AnswerIncorrectError.prototype)
  }
}

export class ChallengeExpiredError extends WebrpcError {
  constructor(
    name: string = 'ChallengeExpired',
    code: number = 7004,
    message: string = `The challenge has expired`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, ChallengeExpiredError.prototype)
  }
}

export class TooManyAttemptsError extends WebrpcError {
  constructor(
    name: string = 'TooManyAttempts',
    code: number = 7005,
    message: string = `Too many attempts`,
    status: number = 0,
    cause?: string,
  ) {
    super(name, code, message, status, cause)
    Object.setPrototypeOf(this, TooManyAttemptsError.prototype)
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
  InternalError = 'InternalError',
  EncryptionError = 'EncryptionError',
  DatabaseError = 'DatabaseError',
  DataIntegrityError = 'DataIntegrityError',
  IdentityProviderError = 'IdentityProviderError',
  InvalidRequest = 'InvalidRequest',
  InvalidSignature = 'InvalidSignature',
  KeyNotFound = 'KeyNotFound',
  KeyExpired = 'KeyExpired',
  SignerNotFound = 'SignerNotFound',
  ProofVerificationFailed = 'ProofVerificationFailed',
  AnswerIncorrect = 'AnswerIncorrect',
  ChallengeExpired = 'ChallengeExpired',
  TooManyAttempts = 'TooManyAttempts',
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
  [7100]: InternalErrorError,
  [7101]: EncryptionErrorError,
  [7102]: DatabaseErrorError,
  [7103]: DataIntegrityErrorError,
  [7104]: IdentityProviderErrorError,
  [7200]: InvalidRequestError,
  [7201]: InvalidSignatureError,
  [7202]: KeyNotFoundError,
  [7203]: KeyExpiredError,
  [7204]: SignerNotFoundError,
  [7002]: ProofVerificationFailedError,
  [7003]: AnswerIncorrectError,
  [7004]: ChallengeExpiredError,
  [7005]: TooManyAttemptsError,
}

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

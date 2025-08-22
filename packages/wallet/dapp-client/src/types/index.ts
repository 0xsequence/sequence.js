/* eslint-disable @typescript-eslint/no-explicit-any */
import { Attestation, Payload } from '@0xsequence/wallet-primitives'
import { Signers } from '@0xsequence/wallet-core'
import { Address, Hex } from 'ox'
import type { TypedData } from 'ox/TypedData'

// --- Public Interfaces and Constants ---

export const RequestActionType = {
  CREATE_NEW_SESSION: 'createNewSession',
  ADD_EXPLICIT_SESSION: 'addExplicitSession',
  MODIFY_EXPLICIT_SESSION: 'modifyExplicitSession',
  SIGN_MESSAGE: 'signMessage',
  SIGN_TYPED_DATA: 'signTypedData',
} as const

export type LoginMethod = 'google' | 'apple' | 'email' | 'passkey' | 'mnemonic'

export interface GuardConfig {
  url: string
  address: Address.Address
}

// --- Payloads for Transport ---

export interface CreateNewSessionPayload {
  sessionAddress: Address.Address
  origin: string
  permissions?: Signers.Session.ExplicitParams
  includeImplicitSession?: boolean
  preferredLoginMethod?: LoginMethod
  email?: string
}

export interface AddExplicitSessionPayload {
  sessionAddress: Address.Address
  permissions: Signers.Session.ExplicitParams
  preferredLoginMethod?: LoginMethod
  email?: string
}

export interface ModifySessionPayload {
  walletAddress: Address.Address
  sessionAddress: Address.Address
  permissions: Signers.Session.ExplicitParams
}

export interface SignMessagePayload {
  address: Address.Address
  message: string
  chainId: number
}

export interface SignTypedDataPayload {
  address: Address.Address
  typedData: TypedData
  chainId: number
}

export interface ConnectSuccessResponsePayload {
  walletAddress: string
  attestation?: Attestation.Attestation
  signature?: Hex.Hex
  userEmail?: string
  loginMethod?: LoginMethod
  guard?: GuardConfig
}

export interface ModifySessionSuccessResponsePayload {
  walletAddress: string
  sessionAddress: string
}

export interface SignatureResponse {
  signature: Hex.Hex
  walletAddress: string
}

export interface ExplicitSessionResponsePayload {
  walletAddress: string
  sessionAddress: string
}

// --- Dapp-facing Types ---

export type RandomPrivateKeyFn = () => Hex.Hex | Promise<Hex.Hex>

type RequiredKeys = 'to' | 'data' | 'value'

export type Transaction =
  // Required properties from Payload.Call
  Pick<Payload.Call, RequiredKeys> &
    // All other properties from Payload.Call, but optional
    Partial<Omit<Payload.Call, RequiredKeys>>

export type Session = {
  address: Address.Address
  isImplicit: boolean
  permissions?: Signers.Session.ExplicitParams
  chainId?: number
}

// --- Event Types ---

export type ChainSessionManagerEvent = 'signatureResponse' | 'sessionsUpdated' | 'explicitSessionResponse'

export type SignatureEventListener = (data: {
  action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA']
  response?: SignatureResponse
  error?: any
}) => void

export type ExplicitSessionEventListener = (data: {
  action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION']
  response?: ExplicitSessionResponsePayload
  error?: any
}) => void

// A generic listener for events from the DappClient
export type DappClientEventListener = (data?: any) => void

export type DappClientSignatureEventListener = (data: {
  action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA']
  response?: SignatureResponse
  error?: any
  chainId: number
}) => void

export type DappClientExplicitSessionEventListener = (data: {
  action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION']
  response?: ExplicitSessionResponsePayload
  error?: any
  chainId: number
}) => void

// --- DappTransport Types ---

export interface SequenceSessionStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export enum MessageType {
  WALLET_OPENED = 'WALLET_OPENED',
  INIT = 'INIT',
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
}

export enum TransportMode {
  POPUP = 'popup',
  REDIRECT = 'redirect',
}

export interface PopupModeOptions {
  requestTimeoutMs?: number
  handshakeTimeoutMs?: number
}

export interface TransportMessage<T = any> {
  id: string
  type: MessageType
  sessionId?: string
  action?: string
  payload?: T
  error?: any
}

export interface BaseRequest {
  type: string
}

export interface MessageSignatureRequest extends BaseRequest {
  type: 'message_signature'
  message: string
  address: Address.Address
  chainId: number
}

export interface TypedDataSignatureRequest extends BaseRequest {
  type: 'typed_data_signature'
  typedData: unknown
  address: Address.Address
  chainId: number
}

export const WalletSize = {
  width: 380,
  height: 600,
}

export interface PendingRequest {
  resolve: (payload: any) => void
  reject: (error: any) => void
  timer: number
  action: string
}

export interface SendRequestOptions {
  timeout?: number
  path?: string
}

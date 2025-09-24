/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExplicitSession } from '@0xsequence/wallet-core'
import { Attestation, Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import type { TypedData } from 'ox/TypedData'

// --- Public Interfaces and Constants ---

export const RequestActionType = {
  CREATE_NEW_SESSION: 'createNewSession',
  ADD_EXPLICIT_SESSION: 'addExplicitSession',
  MODIFY_EXPLICIT_SESSION: 'modifyExplicitSession',
  SIGN_MESSAGE: 'signMessage',
  SIGN_TYPED_DATA: 'signTypedData',
  SEND_WALLET_TRANSACTION: 'sendWalletTransaction',
} as const

export type LoginMethod = 'google' | 'apple' | 'email' | 'passkey' | 'mnemonic'

export interface GuardConfig {
  url: string
  moduleAddresses: Map<Address.Address, Address.Address>
}

// --- Payloads for Transport ---

export interface CreateNewSessionPayload {
  origin?: string
  session?: ExplicitSession
  includeImplicitSession?: boolean
  preferredLoginMethod?: LoginMethod
  email?: string
}

export interface AddExplicitSessionPayload {
  session: ExplicitSession
  preferredLoginMethod?: LoginMethod
  email?: string
}

export interface ModifyExplicitSessionPayload {
  walletAddress: Address.Address
  session: ExplicitSession
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

export interface SendWalletTransactionPayload {
  address: Address.Address
  transactionRequest: TransactionRequest
  chainId: number
}

export type TransactionRequest = {
  to: Address.Address
  value?: bigint
  data?: Hex.Hex
  gasLimit?: bigint
}

export interface CreateNewSessionResponse {
  walletAddress: string
  attestation?: Attestation.Attestation
  signature?: Hex.Hex
  userEmail?: string
  loginMethod?: LoginMethod
  guard?: GuardConfig
}

export interface SignatureResponse {
  signature: Hex.Hex
  walletAddress: string
}

export interface SendWalletTransactionResponse {
  transactionHash: Hex.Hex
  walletAddress: string
}

export type WalletActionResponse = SignatureResponse | SendWalletTransactionResponse

export interface SessionResponse {
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

// --- Event Types ---

export type ExplicitSessionEventListener = (data: {
  action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION']
  response?: SessionResponse
  error?: any
}) => void

// A generic listener for events from the DappClient
export type DappClientEventListener = (data?: any) => void

export type DappClientWalletActionEventListener = (data: {
  action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA' | 'SEND_WALLET_TRANSACTION']
  response?: WalletActionResponse
  error?: any
  chainId: number
}) => void

export type DappClientExplicitSessionEventListener = (data: {
  action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION']
  response?: SessionResponse
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

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponse, JsonRpcHandler } from '@0xsequence/network'
import { TypedData } from '@0xsequence/utils'

// export class SequenceError extends Error {}

export interface WalletSession {
  // Wallet context
  walletContext?: WalletContext

  // Account address of the wallet
  accountAddress?: string

  // Networks in use for the session. The default/dapp network will show
  // up as the first one in the list as the "main chain"
  networks?: NetworkConfig[]

  // Caching provider responses for things such as account and chainId
  providerCache?: {[key: string]: any}
}

export interface ProviderTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void

  openWallet(path?: string, intent?: OpenWalletIntent, defaultNetworkId?: string | number): void
  closeWallet(): void

  isOpened(): boolean
  isConnected(): boolean

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void): void
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void): void

  waitUntilOpened(): Promise<boolean>
  waitUntilConnected(): Promise<WalletSession>
}

export interface WalletTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void
  
  notifyOpen(openInfo: { chainId?: string, sessionId?: string }): void
  notifyClose(): void

  notifyConnect(connectInfo: { chainId?: string }): void
  notifyAccountsChanged(accounts: string[]): void
  notifyChainChanged(connectInfo: any): void
  notifyNetworks(networks: NetworkConfig[]): void
}

export interface ProviderMessage<T> {
  idx: number       // message id sequence number
  type: string      // message type
  data: T           // the ethereum json-rpc payload
  chainId?: number  // chain id which the message is intended
}

export type ProviderMessageRequest = ProviderMessage<JsonRpcRequest>

export type ProviderMessageResponse = ProviderMessage<JsonRpcResponse>

// ProviderMessageCallback is used to respond to ProviderMessage requests. The error
// argument is for exceptions during the execution, and response is the response payload
// which may contain the result or an error payload from the wallet.
export type ProviderMessageResponseCallback = (error: any, response?: ProviderMessageResponse) => void

export interface ProviderConnectInfo {
  chainId: string
}

export interface ProviderRpcError extends Error {
  message: string
  code: number
  data?: {[key: string]: any}
}

export interface ProviderMessageRequestHandler {
  // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet.
  // This method is similar to `sendMessage`, but it expects a response to this message.
  sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse>
}

export interface ProviderMessageTransport {
  // handleMessage will handle a message received from the remote wallet
  handleMessage(message: ProviderMessage<any>): void

  // sendMessage will send the provider message over the wire
  sendMessage(message: ProviderMessage<any>): void
}

export type WalletMessageEvent = 'open' | 'close' | 'connect' | 'disconnect' | 'chainChanged' | 'accountsChanged' | 'networks' | 'walletContext' | 'init' | '_debug'

export type ProviderMessageEvent = 'message' | WalletMessageEvent

export enum ProviderMessageType {
  OPEN = 'open',
  CLOSE = 'close',

  MESSAGE = 'message',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CHAIN_CHANGED = 'chainChanged',
  ACCOUNTS_CHANGED = 'accountsChanged',

  NETWORKS = 'networks',
  WALLET_CONTEXT = 'walletContext',

  INIT = 'init',
  DEBUG = '_debug'
}

export enum OpenState {
  CLOSED = 0,
  OPENING = 1,
  OPENED = 2
}

export enum InitState {
  NIL = 0,
  SENT_NONCE = 1,
  OK = 2
}

export type NetworkEventPayload = NetworkConfig

export interface ConnectOptions {
  refresh?: boolean
  requestAuthorization?: boolean
  requestEmail?: boolean
}

export interface ConnectDetails {
  success: boolean
  proof?: {
    type?: string
    sig: string
  }
  email?: string
}

export type OpenWalletIntent =
  { type: 'connect'; options?: ConnectOptions } |
  { type: 'jsonRpcRequest'; method: string }

export interface MessageToSign {
  message?: string
  typedData?: TypedData
  chainId?: number
}

import { NetworkConfig, JsonRpcRequest, JsonRpcResponse, JsonRpcHandler } from '@0xsequence/network'

// export class SequenceError extends Error {}

export interface WalletSession {
  // Account address of the wallet
  accountAddress?: string

  // Networks in use for the session. The default/dapp network will show
  // up as the first one in the list as the "main chain"
  networks?: NetworkConfig[]

  // Caching provider responses for things such as account and chainId
  providerCache?: {[key: string]: any}
}

export interface ProviderTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  openWallet(path?: string, state?: any): void
  closeWallet()
  isConnected(): boolean
  on(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  waitUntilConnected(): Promise<boolean>
  waitUntilLoggedIn(): Promise<WalletSession>
}

export interface WalletTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  register()
  unregister()
  notifyConnect(connectInfo: { chainId?: string, sessionId?: string })
  notifyAccountsChanged(accounts: string[])
  notifyChainChanged(connectInfo: any)
  notifyNetworks(networks: NetworkConfig[])
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

// TODO: where do we use this..?
export interface ProviderRpcError extends Error {
  code: number
  data?: {[key: string]: any}
}

export interface ProviderMessageRequestHandler {
  // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet.
  // This method is similar to `sendMessage`, but it expects a response to this message.
  sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse>
}

export interface ProviderMessageTransport { //extends ProviderMessageRequestHandler {
  // handleMessage will handle a message received from the remote wallet
  handleMessage(message: ProviderMessage<any>): void

  // sendMessage will send the provider message over the wire
  sendMessage(message: ProviderMessage<any>): void
}

export type WalletMessageEvent = 'chainChanged' | 'accountsChanged' | 'login' | 'logout' | 'networks' | 'debug'

export type ProviderMessageEvent = 'message' | 'connect' | 'disconnect' | 'debug' | WalletMessageEvent

export enum ProviderMessageType {
  MESSAGE = 'message',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CHAIN_CHANGED = 'chainChanged',
  ACCOUNTS_CHANGED = 'accountsChanged',
  NETWORKS = 'networks',

  DEBUG = '_debug'
}

export type NetworkEventPayload = NetworkConfig

export interface MessageToSign {
  message?: string
  typedData?: TypedData
  chainId?: number
}

// TODO: deprecate
import { TypedData } from 'ethers-eip712'
export type { TypedData }

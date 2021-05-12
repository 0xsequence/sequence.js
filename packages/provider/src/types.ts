import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponse, JsonRpcHandler } from '@0xsequence/network'
import { TypedData } from '@0xsequence/utils'

export interface ProviderTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void

  openWallet(path?: string, intent?: OpenWalletIntent, networkId?: string | number): void
  closeWallet(): void

  isOpened(): boolean
  isConnected(): boolean

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void): void
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void): void

  waitUntilOpened(): Promise<boolean>
  waitUntilConnected(): Promise<ConnectDetails>
}

export interface WalletTransport extends JsonRpcHandler, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void
  
  // TODO: ..?
  // closeWallet(): void

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
  // networkId specifics the default network a dapp would like to connect to. This field
  // is optional as it can be provided a number of different ways.
  networkId?: string | number

  // app name of the dapp which will be announced to user on connect screen
  appName?: string

  // origin ....
  origin?: string

  // authorize will perform an ETHAuth eip712 signing and return the proof to the dapp
  authorize?: boolean

  // askForEmail will prompt to give permission to the dapp to access email address
  // TODO: this feature is currently not used as the wallet does not report emails yet
  askForEmail?: boolean

  // refresh flag will force a full re-connect (ie. disconnect then connect again)
  refresh?: boolean

  // keepWalletOpened will keep the wallet window opened after connecting, as the default
  // is to automatically close the wallet upon connecting.
  keepWalletOpened?: boolean
}

export interface ConnectDetails {
  // chainId and error are defined by EIP-1193 expected fields
  chainId?: string
  error?: string

  // connected flag denotes user-accepted the connect request
  connected: boolean

  // session include account and network information needed by the dapp wallet provider.
  session?: WalletSession

  // proof is a signed typedData (EIP-712) payload using ETHAuth domain.
  // NOTE: the proof is signed to the `authChainId`, as the canonical auth chain.
  proof?: ETHAuthProof

  // email address provided from wallet to the dapp, as request + accepted
  // by a user during a connect request
  email?: string
}

// export interface PromptConnectOptions extends ConnectOptions {
//   // TODO: keep/move...? hmpf.......?
//   origin?: string
// }

export type PromptConnectDetails = Pick<ConnectDetails, 'connected' | 'proof' | 'email'>

export type OpenWalletIntent =
  { type: 'connect'; options?: ConnectOptions } |
  { type: 'jsonRpcRequest'; method: string }

export interface MessageToSign {
  message?: string
  typedData?: TypedData
  chainId?: number
}

export interface ETHAuthProof {
  // eip712 typed-data payload for ETHAuth domain as input
  typedData: TypedData

  // signature encoded in an ETHAuth proof string
  proofString: string
}

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

// export class SequenceError extends Error {}

import { ETHAuthProof as AuthETHAuthProof } from '@0xsequence/auth'
import { commons } from '@0xsequence/core'
import {
  ChainIdLike,
  EIP1193Provider,
  JsonRpcRequest,
  JsonRpcResponse,
  NetworkConfig,
  JsonRpcErrorPayload
} from '@0xsequence/network'
import { TypedData } from '@0xsequence/utils'

export interface ProviderTransport extends EIP1193Provider, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void

  openWallet(path?: string, intent?: OpenWalletIntent, networkId?: string | number): void
  closeWallet(): void

  isOpened(): boolean
  isConnected(): boolean

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]): void
  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]): void
  emit<K extends keyof ProviderEventTypes>(event: K, ...args: Parameters<ProviderEventTypes[K]>): boolean

  waitUntilOpened(): Promise<WalletSession | undefined>
  waitUntilConnected(): Promise<ConnectDetails>
}

export function isProviderTransport(transport: any): transport is ProviderTransport {
  return (
    transport &&
    typeof transport === 'object' &&
    typeof transport.register === 'function' &&
    typeof transport.unregister === 'function' &&
    typeof transport.openWallet === 'function' &&
    typeof transport.closeWallet === 'function' &&
    typeof transport.isOpened === 'function' &&
    typeof transport.isConnected === 'function' &&
    typeof transport.on === 'function'
  )
}

export interface WalletTransport extends EIP1193Provider, ProviderMessageTransport, ProviderMessageRequestHandler {
  register(): void
  unregister(): void

  notifyOpen(openInfo: { chainId?: string; sessionId?: string; session?: WalletSession; error?: string }): void
  notifyClose(error?: ProviderRpcError): void

  notifyConnect(connectDetails: ConnectDetails): void
  notifyAccountsChanged(accounts: string[]): void
  notifyChainChanged(chainIdHex: string): void
  notifyNetworks(networks: NetworkConfig[]): void
}

export interface ProviderMessage<T> {
  idx: number // message id number
  type: string // message type
  data: T // the ethereum json-rpc payload
  chainId?: number // chain id which the message is intended
  origin?: string // origin of the message
  clientVersion: string // client version of the message
  projectAccessKey?: string // project access key
}

export type ProviderMessageRequest = ProviderMessage<JsonRpcRequest>

// Older versions of sequence.js will require a JsonRpcResponse result type, but newer versions use raw EIP1193 results
export type ProviderMessageResponse = ProviderMessage<JsonRpcResponse | any>

// ProviderMessageCallback is used to respond to ProviderMessage requests. The error
// argument is for exceptions during the execution, and response is the response payload
// which may contain the result or an error payload from the wallet.
export type ProviderMessageResponseCallback = (error?: ProviderRpcError, response?: ProviderMessageResponse) => void

export type ProviderRpcError = JsonRpcErrorPayload

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

export type WindowSessionParam = 'sid' | 'net' | 'intent'

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface WindowSessionParams extends URLSearchParams {
  get(name: WindowSessionParam): string | null
  set(name: WindowSessionParam, value: string): void
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class WindowSessionParams extends URLSearchParams {
  static new(init?: Record<WindowSessionParam, string> | string) {
    return new URLSearchParams(init) as WindowSessionParams
  }
}

export interface TransportSession {
  sessionId?: string | null
  networkId?: string | number | null
  intent?: OpenWalletIntent
}

export enum EventType {
  OPEN = 'open',
  CLOSE = 'close',

  MESSAGE = 'message',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ACCOUNTS_CHANGED = 'accountsChanged',
  CHAIN_CHANGED = 'chainChanged',

  NETWORKS = 'networks',
  WALLET_CONTEXT = 'walletContext',

  INIT = 'init',
  DEBUG = '_debug'
}

export interface WalletEventTypes {
  open: (openInfo: { chainId?: string; sessionId?: string; session?: WalletSession; error?: string }) => void
  close: (error?: ProviderRpcError) => void

  connect: (connectDetails: ConnectDetails) => void
  disconnect: (error?: ProviderRpcError, origin?: string) => void

  accountsChanged: (accounts: string[], origin?: string) => void
  chainChanged: (chainIdHex: string, origin?: string) => void

  networks: (networks: NetworkConfig[]) => void
  walletContext: (walletContext: commons.context.VersionedContext) => void
}

export interface ProviderEventTypes extends WalletEventTypes {
  message: (message: ProviderMessageResponse) => void
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

export interface ConnectOptions {
  /** app name of the dapp which will be announced to user on connect screen */
  app: string

  /** custom protocol for auth redirect (unity/unreal) */
  appProtocol?: string

  /** origin hint of the dapp's host opening the wallet. This value will automatically
   * be determined and verified for integrity, and can be omitted. */
  origin?: string

  /** access key for the project that can be obtained from Sequence Builder on sequence.build.
   * This value will be automatically populated using the key passed in initWallet. */
  projectAccessKey?: string

  /** expiry number (in seconds) that is used for ETHAuth proof. Default is 1 week in seconds. */
  expiry?: number

  /** authorize will perform an ETHAuth eip712 signing and return the proof to the dapp. */
  authorize?: boolean

  /** authorizeNonce is an optional number to be passed as ETHAuth's nonce claim for replay protection. **/
  authorizeNonce?: number

  /** authorizeVersion is the version of the SDK that will validate the ETHAuth proof. */
  authorizeVersion?: number

  /** askForEmail will prompt to give permission to the dapp to access email address */
  askForEmail?: boolean

  /** refresh flag will force a full re-connect (ie. disconnect then connect again) */
  refresh?: boolean

  /** keepWalletOpened will keep the wallet window opened after connecting. The default
   * is to automatically close the wallet after connecting. */
  keepWalletOpened?: boolean

  /** clientVersion is the sequence.js version of the dapp client. */
  clientVersion?: string

  /** Options to further customize the wallet experience. */
  settings?: Settings
}

export interface NetworkedConnectOptions extends ConnectOptions {
  /** chainId is the chainId to connect to. If not specified, the default chainId
   * will be used. This does not define a default chain id, it is only used for the connect
   * authorization signature. */
  networkId?: string | number
}

/** Options to further customize the wallet experience. */
export interface Settings {
  /** Specify a wallet theme. `light` and `dark` are the main themes, to use other available
   * themes, you can use the camel case version of the theme names in the wallet settings.
   * For example: "Blue Dark" on wallet UI can be passed as "blueDark".
   * Note that this setting will not be persisted, use wallet.open with 'openWithOptions' intent
   * to set when you open the wallet for user. */
  theme?: ThemeOption

  /** Specify a banner image. This image, if provided, will be displayed on the wallet during
   * the connect/authorize process */
  bannerUrl?: string

  bannerSize?: BannerSize

  /** Specify payment providers to use. If not specified,
   * all available payment providers will be enabled.
   * Note that this setting will not be persisted, use wallet.open with 'openWithOptions' intent
   * to set when you open the wallet for user. */
  includedPaymentProviders?: PaymentProviderOption[]

  /** Specify a default currency to use with payment providers.
   * If not specified, the default is USDC.
   * Note that this setting will not be persisted, use wallet.open with 'openWithOptions' intent
   * to set when you open the wallet for user. */
  defaultFundingCurrency?: CurrencyOption

  /** Specify default purchase amount as an integer, for prefilling the funding amount.
   * If not specified, the default is 100.
   * Note that this setting will not be persisted, use wallet.open with 'openWithOptions' intent
   * to set when you open the wallet for user. */
  defaultPurchaseAmount?: number

  /** If true, lockFundingCurrencyToDefault disables picking any currency provided by payment
   * providers other than the defaultFundingCurrency.
   * If false, it allows picking any currency provided by payment providers.
   * The default is true.
   * Note that this setting will not be persisted, use wallet.open with 'openWithOptions' intent
   * to set when you open the wallet for user. */
  lockFundingCurrencyToDefault?: boolean

  /** Specify an auth provider to allow dapp to specify ahead of time which auth method to redirect to.
   * Will be ignored if user is already signed in.
   */
  signInWith?: SignInOption

  /** Specify an email address to allow user automatically sign in with the email option.
   * Will be ignored if user is already signed in.
   */
  signInWithEmail?: string

  /** Specify which sign in options are allowed.
   * Will be ignored if user is already signed in.
   */
  signInOptions?: SignInOption[]

  /** Specify auxiliary data
   */
  aux?: any
}

/** light and dark are the main themes, to use other themes in wallet settings,
 * you can use the camel case version of the name in the wallet settings.
 * For example: "Blue Dark" on wallet UI can be passed as "blueDark" */
export type ThemeOption = 'light' | 'dark' | string
export type PaymentProviderOption = 'ramp' | 'moonpay' | 'transak' | 'onmeta' | 'paytrie' | 'sardine'
export type CurrencyOption = 'usdc' | 'eth' | 'matic'
export type SignInOption = 'email' | 'google' | 'apple' | 'facebook' | 'discord' | 'twitch'
export type BannerSize = 'small' | 'medium' // | 'large'

export interface ConnectDetails {
  // chainId (in hex) and error are defined by EIP-1193 expected fields
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

export type PromptConnectDetails = Pick<ConnectDetails, 'chainId' | 'error' | 'connected' | 'proof' | 'email'>

export type OpenWalletIntent =
  | { type: 'connect'; options?: NetworkedConnectOptions }
  | { type: 'openWithOptions'; options?: ConnectOptions }
  | { type: 'jsonRpcRequest'; method: string }

export interface MessageToSign {
  message?: Uint8Array
  typedData?: TypedData
  chainId?: number

  eip6492?: boolean
}

export type ETHAuthProof = AuthETHAuthProof

export interface WalletSession {
  // Wallet context
  walletContext?: commons.context.VersionedContext

  // Account address of the wallet
  accountAddress?: string

  // Networks in use for the session. The default/dapp network will show
  // up as the first one in the list as the "main chain"
  networks?: NetworkConfig[]
}

export class ProviderError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

export const ErrSignedInRequired = new ProviderError('Wallet is not signed in. Connect a wallet and try again.')

// TODO: lets build some nice error handling tools, prob in /utils ...

export interface TypedEventEmitter<Events> {
  addListener<E extends keyof Events>(event: E, listener: Events[E]): this
  on<E extends keyof Events>(event: E, listener: Events[E]): this
  once<E extends keyof Events>(event: E, listener: Events[E]): this
  prependListener<E extends keyof Events>(event: E, listener: Events[E]): this
  prependOnceListener<E extends keyof Events>(event: E, listener: Events[E]): this

  off<E extends keyof Events>(event: E, listener: Events[E]): this
  removeAllListeners<E extends keyof Events>(event?: E): this
  removeListener<E extends keyof Events>(event: E, listener: Events[E]): this

  emit<E extends keyof Events>(event: E, ...args: Arguments<Events[E]>): boolean
  eventNames(): (keyof Events | string | symbol)[]

  // eslint-disable-next-line
  listeners<E extends keyof Events>(event: E): Function[]
  listenerCount<E extends keyof Events>(event: E): number
}

type Arguments<T> = [T] extends [(...args: infer U) => any] ? U : [T] extends [void] ? [] : [T]

export type OptionalChainIdLike =
  | {
      chainId?: ChainIdLike
    }
  | undefined

export type OptionalChainId =
  | {
      chainId?: number
    }
  | undefined

export type OptionalEIP6492 =
  | {
      eip6492?: boolean
    }
  | undefined

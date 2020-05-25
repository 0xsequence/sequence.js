import { BigNumberish, Arrayish } from 'ethers/utils'
import { TransactionRequest } from 'ethers/providers'

export interface LedgerCommunicationClient {
  close: () => Promise<void>
}

export interface ECSignatureString {
  v: string
  r: string
  s: string
}

/**
 * addressSearchLimit: The maximum number of addresses to search through, defaults to 1000
 * numAddressesToReturn: Number of addresses to return from 'eth_accounts' call
 * shouldAskForOnDeviceConfirmation: Whether you wish to prompt the user on their Ledger
 *                   before fetching their addresses
 */
export interface AccountFetchingConfigs {
  addressSearchLimit?: number
  numAddressesToReturn?: number
  shouldAskForOnDeviceConfirmation?: boolean
}

/**
 * mnemonic: The string mnemonic seed
 * addressSearchLimit: The maximum number of addresses to search through, defaults to 1000
 * baseDerivationPath: The base derivation path (e.g 44'/60'/0'/0)
 */
export interface MnemonicWalletSubproviderConfigs {
  mnemonic: string
  addressSearchLimit?: number
  baseDerivationPath?: string
}

export interface SignatureData {
  hash: string
  r: string
  s: string
  v: number
}

export interface LedgerGetAddressResult {
  address: string
  publicKey: string
  chainCode: string
}

export interface PartialTxParams {
  nonce: string
  gasPrice?: string
  gas: string
  to: string
  from: string
  value?: string
  data?: string
  chainId: number // EIP 155 chainId - mainnet: 1, ropsten: 3
}

export type DoneCallback = (err?: Error) => void

export interface LedgerCommunication {
  close_async: () => Promise<void>
}

export interface ResponseWithTxParams {
  raw: string
  tx: PartialTxParams
}

export enum WalletSubproviderErrors {
  AddressNotFound = 'ADDRESS_NOT_FOUND',
  DataMissingForSignPersonalMessage = 'DATA_MISSING_FOR_SIGN_PERSONAL_MESSAGE',
  DataMissingForSignTypedData = 'DATA_MISSING_FOR_SIGN_TYPED_DATA',
  SenderInvalidOrNotSupplied = 'SENDER_INVALID_OR_NOT_SUPPLIED',
  FromAddressMissingOrInvalid = 'FROM_ADDRESS_MISSING_OR_INVALID',
  MethodNotSupported = 'METHOD_NOT_SUPPORTED'
}
export enum LedgerSubproviderErrors {
  TooOldLedgerFirmware = 'TOO_OLD_LEDGER_FIRMWARE',
  MultipleOpenConnectionsDisallowed = 'MULTIPLE_OPEN_CONNECTIONS_DISALLOWED'
}

export enum NonceSubproviderErrors {
  EmptyParametersFound = 'EMPTY_PARAMETERS_FOUND',
  CannotDetermineAddressFromPayload = 'CANNOT_DETERMINE_ADDRESS_FROM_PAYLOAD'
}

export type ErrorCallback = (err: Error | null, data?: any) => void
export type Callback = () => void
export type OnNextCompleted = (err: Error | null, result: any, cb: Callback) => void
export type NextCallback = (callback?: OnNextCompleted) => void

export interface TrezorSubproviderConfig {
  accountFetchingConfigs: AccountFetchingConfigs
  trezorConnectClientApi: any
  networkId: number
}

export interface TrezorGetPublicKeyResponsePayload {
  path: {
    [index: number]: number
  }
  serializedPath: string
  childNumb: number
  xpub: string
  chainCode: string
  publicKey: string
  fingerprint: number
  depth: number
}

export interface TrezorSignTxResponsePayload {
  v: string
  r: string
  s: string
}

export interface TrezorSignMsgResponsePayload {
  address: string
  signature: string
}

export interface TrezorResponseErrorPayload {
  error: string
}

export interface TrezorConnectResponse {
  payload: any
  id: number
  success: boolean
}

export interface ArcadeumWalletConfig {
  threshold: number
  signers: {
    weight: number
    address: string
  }[]
}

export interface ArcadeumContext {
  factory: string
  mainModule: string
}

export interface ArcadeumDecodedSignature {
  threshold: number
  signers: (ArcadeumDecodedSigner | ArcadeumDecodedOwner)[]
}

export interface ArcadeumDecodedOwner {
  weight: number
  address: string
}

export interface ArcadeumDecodedSigner {
  r: string
  s: string
  v: number
  t: number
  weight: number
}

export interface ArcadeumTransaction {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  to: string
  value: BigNumberish
  data: Arrayish
  nonce?: BigNumberish
}

export declare interface Web3Payload {
  method: string
  params: any[]
  id: number
  jsonrpc: string
}

export declare interface Web3Response {
  id: number
  jsonrpc: string
  result: any
}

export interface ArcadeumTransactionEncoded {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  target: string
  value: BigNumberish
  data: Arrayish
}

export type AuxTransactionRequest = TransactionRequest & {
  auxiliary?: Transactionish[]
}

export declare type Transactionish = AuxTransactionRequest | ArcadeumTransaction | ArcadeumTransaction[] | AuxTransactionRequest[]

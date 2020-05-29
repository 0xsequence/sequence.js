import { BigNumberish, Arrayish } from 'ethers/utils'
import { TransactionRequest } from 'ethers/providers'

export interface JsonRpcRequest {
  jsonrpc: string
  id: number
  method: string
  params: any[]
}

export interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result: any
  error?: any
}

export type JsonRpcResponseCallback = (error: any, response?: JsonRpcResponse) => void

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

export enum NonceSubproviderErrors {
  EmptyParametersFound = 'EMPTY_PARAMETERS_FOUND',
  CannotDetermineAddressFromPayload = 'CANNOT_DETERMINE_ADDRESS_FROM_PAYLOAD'
}

export type ErrorCallback = (err: Error | null, data?: any) => void
export type Callback = () => void
export type OnNextCompleted = (err: Error | null, result: any, cb: Callback) => void
export type NextCallback = (callback?: OnNextCompleted) => void

export interface ArcadeumWalletConfig {
  address?: string,
  threshold: number
  signers: {
    weight: number
    address: string
  }[]
}

export interface ArcadeumContext {
  factory: string
  mainModule: string,
  mainModuleUpgradable: string
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

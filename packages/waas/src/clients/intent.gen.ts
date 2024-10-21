/* eslint-disable */
// sequence-waas-intents v0.1.0 2e4f5d4a4107d8e8c74c252f4d1a7aad391db6e7
// --
// Code generated by webrpc-gen@v0.19.3 with typescript generator. DO NOT EDIT.
//
// webrpc-gen -schema=intent.ridl -target=typescript -out=./intent.gen.ts

// WebRPC description and code-gen version
export const WebRPCVersion = 'v1'

// Schema version of your RIDL schema
export const WebRPCSchemaVersion = 'v0.1.0'

// Schema hash generated from your RIDL schema
export const WebRPCSchemaHash = '2e4f5d4a4107d8e8c74c252f4d1a7aad391db6e7'

//
// Types
//

export enum IntentName {
  initiateAuth = 'initiateAuth',
  openSession = 'openSession',
  closeSession = 'closeSession',
  validateSession = 'validateSession',
  finishValidateSession = 'finishValidateSession',
  listSessions = 'listSessions',
  getSession = 'getSession',
  sessionAuthProof = 'sessionAuthProof',
  feeOptions = 'feeOptions',
  signMessage = 'signMessage',
  sendTransaction = 'sendTransaction',
  getTransactionReceipt = 'getTransactionReceipt',
  federateAccount = 'federateAccount',
  removeAccount = 'removeAccount',
  listAccounts = 'listAccounts',
  getIdToken = 'getIdToken'
}

export enum TransactionType {
  transaction = 'transaction',
  erc20send = 'erc20send',
  erc721send = 'erc721send',
  erc1155send = 'erc1155send',
  delayedEncode = 'delayedEncode',
  contractCall = 'contractCall'
}

export enum IntentResponseCode {
  authInitiated = 'authInitiated',
  sessionOpened = 'sessionOpened',
  sessionClosed = 'sessionClosed',
  sessionList = 'sessionList',
  validationRequired = 'validationRequired',
  validationStarted = 'validationStarted',
  validationFinished = 'validationFinished',
  sessionAuthProof = 'sessionAuthProof',
  signedMessage = 'signedMessage',
  feeOptions = 'feeOptions',
  transactionReceipt = 'transactionReceipt',
  transactionFailed = 'transactionFailed',
  getSessionResponse = 'getSessionResponse',
  accountList = 'accountList',
  accountFederated = 'accountFederated',
  accountRemoved = 'accountRemoved',
  idToken = 'idToken'
}

export enum FeeTokenType {
  unknown = 'unknown',
  erc20Token = 'erc20Token',
  erc1155Token = 'erc1155Token'
}

export enum IdentityType {
  None = 'None',
  Guest = 'Guest',
  OIDC = 'OIDC',
  Email = 'Email',
  PlayFab = 'PlayFab',
  Stytch = 'Stytch'
}

export interface Intent {
  version: string
  name: IntentName
  expiresAt: number
  issuedAt: number
  data: any
  signatures: Array<Signature>
}

export interface Signature {
  sessionId: string
  signature: string
}

export interface IntentDataInitiateAuth {
  sessionId: string
  identityType: IdentityType
  verifier: string
  metadata?: string
}

export interface IntentDataOpenSession {
  sessionId: string
  identityType: IdentityType
  verifier?: string
  answer?: string
  forceCreateAccount?: boolean
  email?: string
  idToken?: string
}

export interface IntentDataCloseSession {
  sessionId: string
}

export interface IntentDataValidateSession {
  sessionId: string
  wallet: string
  deviceMetadata: string
}

export interface IntentDataFinishValidateSession {
  sessionId: string
  wallet: string
  salt: string
  challenge: string
}

export interface IntentDataListSessions {
  wallet: string
}

export interface IntentDataGetSession {
  sessionId: string
  wallet: string
}

export interface IntentDataSessionAuthProof {
  network: string
  wallet: string
  nonce?: string
}

export interface IntentDataSignMessage {
  network: string
  wallet: string
  message: string
}

export interface IntentDataFeeOptions {
  network: string
  wallet: string
  identifier: string
  transactions: Array<any>
}

export interface IntentDataSendTransaction {
  network: string
  wallet: string
  identifier: string
  transactions: Array<any>
  transactionsFeeQuote?: string
}

export interface IntentDataGetTransactionReceipt {
  network: string
  wallet: string
  metaTxHash: string
}

export interface IntentDataFederateAccount {
  sessionId: string
  wallet: string
  identityType: IdentityType
  verifier?: string
  answer?: string
}

export interface IntentDataListAccounts {
  wallet: string
}

export interface IntentDataRemoveAccount {
  wallet: string
  accountId: string
}

export interface IntentDataGetIdToken {
  sessionId: string
  wallet: string
  nonce?: string
}

export interface TransactionRaw {
  type: string
  to: string
  value?: string
  data: string
}

export interface AbiData {
  abi: string
  func?: string
  args: Array<any>
}

export interface TransactionERC20 {
  type: string
  tokenAddress: string
  to: string
  value: string
}

export interface TransactionERC721 {
  type: string
  tokenAddress: string
  to: string
  id: string
  safe?: boolean
  data?: string
}

export interface TransactionERC1155Value {
  id: string
  amount: string
}

export interface TransactionDelayedEncode {
  type: string
  to: string
  value: string
  data: any
}

export interface TransactionContractCall {
  type: string
  to: string
  value?: string
  data: AbiData
}

export interface TransactionERC1155 {
  type: string
  tokenAddress: string
  to: string
  vals: Array<TransactionERC1155Value>
  data?: string
}

export interface IntentResponse {
  code: IntentResponseCode
  data: any
}

export interface IntentResponseAuthInitiated {
  sessionId: string
  identityType: IdentityType
  expiresIn: number
  challenge?: string
}

export interface IntentResponseSessionOpened {
  sessionId: string
  wallet: string
}

export interface IntentResponseSessionClosed {}

export interface IntentResponseValidateSession {}

export interface IntentResponseValidationRequired {
  sessionId: string
}

export interface IntentResponseValidationStarted {
  salt: string
}

export interface IntentResponseValidationFinished {
  isValid: boolean
}

export interface IntentResponseListSessions {
  sessions: Array<string>
}

export interface IntentResponseGetSession {
  sessionId: string
  wallet: string
  validated: boolean
}

export interface IntentResponseSessionAuthProof {
  sessionId: string
  network: string
  wallet: string
  message: string
  signature: string
}

export interface IntentResponseSignedMessage {
  signature: string
  message: string
}

export interface FeeOption {
  token: FeeToken
  to: string
  value: string
  gasLimit: number
}

export interface FeeToken {
  chainId: number
  name: string
  symbol: string
  type: FeeTokenType
  decimals?: number
  logoURL: string
  contractAddress?: string
  tokenID?: string
}

export interface IntentResponseFeeOptions {
  feeOptions: Array<FeeOption>
  feeQuote?: string
}

export interface IntentResponseTransactionReceipt {
  request: any
  txHash: string
  metaTxHash: string
  receipt: any
  nativeReceipt: any
  simulations: any
}

export interface IntentResponseTransactionFailed {
  error: string
  request: any
  simulations: any
}

export interface IntentResponseAccountList {
  accounts: Array<Account>
  currentAccountId: string
}

export interface IntentResponseAccountFederated {
  account: Account
}

export interface IntentResponseAccountRemoved {}

export interface IntentResponseIdToken {
  idToken: string
  expiresIn: number
}

export interface Account {
  id: string
  type: IdentityType
  issuer?: string
  email?: string
}

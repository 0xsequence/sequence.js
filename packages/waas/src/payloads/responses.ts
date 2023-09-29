import { ethers } from "ethers"

export type PayloadResponse = {
  code: string
  data: any
}

export type ValidationRequiredResponse = {
  code: 'validationRequired'
  data: {
    sessionId: string
  }
}

export type SendTransactionResponse = {
  code: 'transactionReceipt'
  data: {
    txHash: string
  }
}

export type OpenSessionResponse = {
  code: 'sessionOpened'
  data: {
    sessionId: string
    wallet: string
  }
}

export type SignedMessageResponse = {
  code: 'signedMessage'
  data: {
    message: string
    signature: string
  }
}

export function isOpenSessionResponse(receipt: any): receipt is OpenSessionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'sessionOpened' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string' &&
    typeof receipt.data.wallet === 'string'
  )
}

export function isSendTransactionResponse(receipt: any): receipt is SendTransactionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'transactionReceipt' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.txHash === 'string'
  )
}

export function isSignedMessageResponse(receipt: any): receipt is SignedMessageResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'signedMessage' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.message === 'string' &&
    typeof receipt.data.signature === 'string'
  )
}

export function isValidationRequiredResponse(receipt: any): receipt is ValidationRequiredResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'validationRequired' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string'
  )
}

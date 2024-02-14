import { ethers } from 'ethers'
import { JsonRpcSender } from './types'

// TODOXXX: review..
export function isJsonRpcProvider(cand: any): cand is ethers.JsonRpcProvider {
  return (
    cand !== undefined &&
    cand.send !== undefined &&
    cand.constructor.defaultUrl !== undefined &&
    cand.detectNetwork !== undefined &&
    cand.getSigner !== undefined &&
    cand.perform !== undefined
  )
}

export function isJsonRpcSender(cand: any): cand is JsonRpcSender {
  return cand !== undefined && cand.send !== undefined
}

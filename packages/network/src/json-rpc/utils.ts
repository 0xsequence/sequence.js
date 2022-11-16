import { providers } from 'ethers'
import { JsonRpcHandler } from './types'

export function isJsonRpcProvider(cand: any): cand is providers.JsonRpcProvider {
  return (
    cand !== undefined &&
    cand.send !== undefined &&
    cand.constructor.defaultUrl !== undefined &&
    cand.detectNetwork !== undefined &&
    cand.getSigner !== undefined &&
    cand.perform !== undefined
  )
}

export function isJsonRpcHandler(cand: any): cand is JsonRpcHandler {
  return cand !== undefined && cand.sendAsync !== undefined
}

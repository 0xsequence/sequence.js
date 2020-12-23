import { JsonRpcProvider } from '@ethersproject/providers'

export function isJsonRpcProvider(cand: any): cand is JsonRpcProvider {
  return (
    cand !== undefined &&
    cand.send !== undefined
  )
}

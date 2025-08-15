import { Precondition, NativeBalancePrecondition, Erc20BalancePrecondition } from './types.js'
import { IntentPrecondition, decodePreconditions } from './codec.js'

export function extractChainID(precondition: IntentPrecondition): bigint | undefined {
  if (!precondition) {
    return undefined
  }

  try {
    const data = JSON.parse(precondition.data)
    return data.chainID ? BigInt(data.chainID) : undefined
  } catch (e) {
    return undefined
  }
}

export function extractSupportedPreconditions(preconditions: IntentPrecondition[]): Precondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  return decodePreconditions(preconditions)
}

export function extractNativeBalancePreconditions(preconditions: IntentPrecondition[]): NativeBalancePrecondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  const decoded = decodePreconditions(preconditions)
  return decoded.filter((p): p is NativeBalancePrecondition => p.type() === 'native-balance')
}

export function extractERC20BalancePreconditions(preconditions: IntentPrecondition[]): Erc20BalancePrecondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  const decoded = decodePreconditions(preconditions)
  return decoded.filter((p): p is Erc20BalancePrecondition => p.type() === 'erc20-balance')
}

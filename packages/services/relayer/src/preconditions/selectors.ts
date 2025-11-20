import { Precondition, NativeBalancePrecondition, Erc20BalancePrecondition } from './types.js'
import { TransactionPrecondition, decodePreconditions } from './codec.js'

export function extractChainID(precondition: TransactionPrecondition): number | undefined {
  if (!precondition) {
    return undefined
  }

  return precondition.chainId
}

export function extractSupportedPreconditions(preconditions: TransactionPrecondition[]): Precondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  return decodePreconditions(preconditions)
}

export function extractNativeBalancePreconditions(
  preconditions: TransactionPrecondition[],
): NativeBalancePrecondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  const decoded = decodePreconditions(preconditions)
  return decoded.filter((p): p is NativeBalancePrecondition => p.type() === 'native-balance')
}

export function extractERC20BalancePreconditions(preconditions: TransactionPrecondition[]): Erc20BalancePrecondition[] {
  if (!preconditions || preconditions.length === 0) {
    return []
  }

  const decoded = decodePreconditions(preconditions)
  return decoded.filter((p): p is Erc20BalancePrecondition => p.type() === 'erc20-balance')
}

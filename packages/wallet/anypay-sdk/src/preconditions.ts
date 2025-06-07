import { IntentPrecondition } from '@0xsequence/api'

export function findPreconditionAddress(preconditions: IntentPrecondition[]): string {
  console.log('Finding precondition address from:', JSON.stringify(preconditions, null, 2))

  const preconditionTypes = ['erc20-balance', 'native-balance'] as const

  for (const type of preconditionTypes) {
    const precondition = preconditions.find((p) => p.type === type && p.data?.address)
    if (precondition) {
      console.log(`Found ${type} precondition with address:`, precondition.data.address)
      return precondition.data.address
    }
  }

  const msg = `N/A (No ${preconditionTypes.join(' or ')} precondition with address found)`
  console.log(msg)
  return msg
}

export function findFirstPreconditionForChainId(
  preconditions: IntentPrecondition[],
  chainId: number,
): IntentPrecondition | null {
  const precondition = preconditions.find(
    (p) => (p.type === 'erc20-balance' || p.type === 'native-balance') && p.chainId === chainId?.toString(),
  )
  return precondition ?? null
}

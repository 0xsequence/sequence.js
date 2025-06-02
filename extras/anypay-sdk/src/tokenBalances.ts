import { useIndexerGatewayClient } from '@0xsequence/hooks'
import { ContractVerificationStatus, NativeTokenBalance, TokenBalance } from '@0xsequence/indexer'
import {
  GetTokenBalancesSummaryReturn,
  GatewayNativeTokenBalances,
  GatewayTokenBalance,
} from '@0xsequence/indexer/dist/declarations/src/indexergw.gen'
import { useQuery } from '@tanstack/react-query'
import { Address } from 'ox'
import { useMemo } from 'react'

export { type NativeTokenBalance, type TokenBalance }

// Default empty page info for query fallback
const defaultPage = { page: 1, pageSize: 10, more: false }

// Type guard for native token balance
function isNativeToken(token: TokenBalance | NativeTokenBalance): boolean {
  if ('contractAddress' in token) {
    return false
  }
  return true
}

export const useTokenBalances = (address: Address.Address) => {
  const indexerClient = useIndexerGatewayClient()

  // Fetch token balances
  const {
    data: tokenBalancesData,
    isLoading: isLoadingBalances,
    error: balanceError,
  } = useQuery<GetTokenBalancesSummaryReturn>({
    queryKey: ['tokenBalances', address],
    queryFn: async () => {
      if (!address) {
        console.warn('No account address or indexer client')
        return { balances: [], nativeBalances: [], page: defaultPage } as GetTokenBalancesSummaryReturn
      }
      try {
        const summary = await indexerClient.getTokenBalancesSummary({
          filter: {
            accountAddresses: [address],
            contractStatus: ContractVerificationStatus.VERIFIED,
            contractTypes: ['ERC20'],
            omitNativeBalances: false,
          },
        })

        return summary
      } catch (error) {
        console.error('Failed to fetch token balances:', error)
        return { balances: [], nativeBalances: [], page: defaultPage } as GetTokenBalancesSummaryReturn
      }
    },
    enabled: !!address,
    staleTime: 30000,
    retry: 1,
  })

  const sortedTokens = useMemo(() => {
    if (!tokenBalancesData?.balances) {
      return []
    }

    // Flatten both native and token balances
    const nativeBalances = tokenBalancesData.nativeBalances.flatMap((b: GatewayNativeTokenBalances) => b.results)
    const tokenBalances = tokenBalancesData.balances.flatMap((b: GatewayTokenBalance) => b.results)
    const balances = [...nativeBalances, ...tokenBalances]

    return [...balances]
      .filter((token) => {
        try {
          return BigInt(token.balance) > 0n
        } catch {
          return false
        }
      })
      .sort((a, b) => {
        if (isNativeToken(a)) return -1
        if (isNativeToken(b)) return 1
        try {
          const balanceA = BigInt(a.balance)
          const balanceB = BigInt(b.balance)
          if (balanceA > balanceB) return -1
          if (balanceA < balanceB) return 1
          return 0
        } catch {
          return 0
        }
      })
  }, [tokenBalancesData])

  return {
    tokenBalancesData,
    isLoadingBalances,
    balanceError,
    sortedTokens,
  }
}

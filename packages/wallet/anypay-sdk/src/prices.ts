import { SequenceAPIClient, Token } from '@0xsequence/api'
import { useQuery } from '@tanstack/react-query'

export const getTokenPrices = async (apiClient: SequenceAPIClient, tokens: Token[]) => {
  if (tokens.length === 0) {
    return []
  }

  const res = await apiClient.getCoinPrices({ tokens })

  return res?.tokenPrices || []
}

export const useTokenPrices = (tokens: Token[], apiClient: SequenceAPIClient) => {
  return useQuery({
    queryKey: ['coinPrices', tokens],
    queryFn: () => {
      return getTokenPrices(apiClient, tokens)
    },
    retry: true,
    staleTime: 60_000,
    enabled: tokens.length > 0,
  })
}

import { SequenceAPIClient } from '@0xsequence/api'
import { useMemo } from 'react'
import { useConfig } from '@0xsequence/hooks'

/**
 * Hook to access the Sequence API client instance.
 *
 * This hook provides a memoized instance of the Sequence API client that can be used
 * to interact with Sequence services. The client is configured with the project's
 * access key and environment-specific API URL.
 *
 * The API client provides access to various Sequence services including:
 * - Exchange rates and pricing
 * - Token swaps and quotes
 * - Wallet linking and management
 * - Token metadata and balances
 *
 * The client instance is memoized based on the project access key, meaning a new
 * instance is only created when the access key changes.
 *
 * @see {@link https://docs.sequence.xyz/sdk/web/hooks/useAPIClient} for more detailed documentation.
 *
 * @returns {SequenceAPIClient} A configured instance of the Sequence API client
 *
 * @example
 * ```tsx
 * const apiClient = useAPIClient()
 *
 * // Get exchange rates
 * const rate = await apiClient.getExchangeRate({ toCurrency: 'EUR' })
 *
 * // Get swap quote
 * const quote = await apiClient.getSwapQuote({
 *   chainId: 1,
 *   userAddress: '0x...',
 *   sellCurrencyAddress: '0x...',
 *   buyCurrencyAddress: '0x...',
 *   sellAmount: '1000000000000000000'
 * })
 * ```
 */

export const useAPIClient = () => {
  const { projectAccessKey, jwt, env } = useConfig()

  const apiClient = useMemo(() => {
    return new SequenceAPIClient(env.apiUrl, projectAccessKey, jwt)
  }, [projectAccessKey, jwt])

  return apiClient
}

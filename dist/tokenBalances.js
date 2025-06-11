import { ContractVerificationStatus, } from '@0xsequence/indexer';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useIndexerGatewayClient } from './indexerClient.js';
// Default empty page info for query fallback
const defaultPage = { page: 1, pageSize: 10, more: false };
// Type guard for native token balance
function isNativeToken(token) {
    if ('contractAddress' in token) {
        return false;
    }
    return true;
}
export function useTokenBalances(address, indexerGatewayClient) {
    const indexerClient = indexerGatewayClient ?? useIndexerGatewayClient();
    // Fetch token balances
    const { data: tokenBalancesData, isLoading: isLoadingBalances, error: balanceError, } = useQuery({
        queryKey: ['tokenBalances', address],
        queryFn: async () => {
            if (!address) {
                console.warn('No account address or indexer client');
                return {
                    balances: [],
                    nativeBalances: [],
                    page: defaultPage,
                };
            }
            try {
                const summaryFromGateway = await indexerClient.getTokenBalancesSummary({
                    filter: {
                        accountAddresses: [address],
                        contractStatus: ContractVerificationStatus.VERIFIED,
                        contractTypes: ['ERC20'],
                        omitNativeBalances: false,
                    },
                });
                return {
                    page: summaryFromGateway.page,
                    balances: summaryFromGateway.balances.flatMap((b) => b.results),
                    nativeBalances: summaryFromGateway.nativeBalances.flatMap((b) => b.results),
                };
            }
            catch (error) {
                console.error('Failed to fetch token balances:', error);
                return {
                    balances: [],
                    nativeBalances: [],
                    page: defaultPage,
                };
            }
        },
        enabled: !!address,
        staleTime: 30000,
        retry: 1,
    });
    const sortedTokens = useMemo(() => {
        if (!tokenBalancesData) {
            return [];
        }
        const balances = [...tokenBalancesData.nativeBalances, ...tokenBalancesData.balances];
        return [...balances]
            .filter((token) => {
            try {
                return BigInt(token.balance) > 0n;
            }
            catch {
                return false;
            }
        })
            .sort((a, b) => {
            if (isNativeToken(a))
                return -1;
            if (isNativeToken(b))
                return 1;
            try {
                const balanceA = BigInt(a.balance);
                const balanceB = BigInt(b.balance);
                if (balanceA > balanceB)
                    return -1;
                if (balanceA < balanceB)
                    return 1;
                return 0;
            }
            catch {
                return 0;
            }
        });
    }, [tokenBalancesData]);
    return {
        tokenBalancesData,
        isLoadingBalances,
        balanceError,
        sortedTokens,
    };
}

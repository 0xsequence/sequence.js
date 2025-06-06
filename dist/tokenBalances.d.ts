import { NativeTokenBalance, TokenBalance, GetTokenBalancesSummaryReturn, SequenceIndexerGateway } from '@0xsequence/indexer';
import { Address } from 'ox';
export { type NativeTokenBalance, type TokenBalance };
export declare function useTokenBalances(address: Address.Address, indexerGatewayClient?: SequenceIndexerGateway): {
    tokenBalancesData: GetTokenBalancesSummaryReturn | undefined;
    isLoadingBalances: boolean;
    balanceError: Error | null;
    sortedTokens: (TokenBalance | NativeTokenBalance)[];
};
//# sourceMappingURL=tokenBalances.d.ts.map
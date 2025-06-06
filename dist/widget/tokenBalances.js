import { ContractVerificationStatus as b } from "./node_modules/.pnpm/@0xsequence_indexer@2.3.17/node_modules/@0xsequence/indexer/dist/0xsequence-indexer.esm.js";
import { useQuery as p } from "./node_modules/.pnpm/@tanstack_react-query@5.80.5_react@19.1.0/node_modules/@tanstack/react-query/build/modern/useQuery.js";
import { useMemo as y } from "react";
import { useIndexerGatewayClient as g } from "./indexerClient.js";
const o = { page: 1, pageSize: 10, more: !1 };
function i(a) {
  return !("contractAddress" in a);
}
function T(a, l) {
  const u = l ?? g(), {
    data: n,
    isLoading: f,
    error: m
  } = p({
    queryKey: ["tokenBalances", a],
    queryFn: async () => {
      if (!a)
        return console.warn("No account address or indexer client"), {
          balances: [],
          nativeBalances: [],
          page: o
        };
      try {
        const t = await u.getTokenBalancesSummary({
          filter: {
            accountAddresses: [a],
            contractStatus: b.VERIFIED,
            contractTypes: ["ERC20"],
            omitNativeBalances: !1
          }
        });
        return {
          page: t.page,
          balances: t.balances.flatMap((e) => e.results),
          nativeBalances: t.nativeBalances.flatMap((e) => e.results)
        };
      } catch (t) {
        return console.error("Failed to fetch token balances:", t), {
          balances: [],
          nativeBalances: [],
          page: o
        };
      }
    },
    enabled: !!a,
    staleTime: 3e4,
    retry: 1
  }), B = y(() => n ? [...[...n.nativeBalances, ...n.balances]].filter((e) => {
    try {
      return BigInt(e.balance) > 0n;
    } catch {
      return !1;
    }
  }).sort((e, r) => {
    if (i(e)) return -1;
    if (i(r)) return 1;
    try {
      const c = BigInt(e.balance), s = BigInt(r.balance);
      return c > s ? -1 : c < s ? 1 : 0;
    } catch {
      return 0;
    }
  }) : [], [n]);
  return {
    tokenBalancesData: n,
    isLoadingBalances: f,
    balanceError: m,
    sortedTokens: B
  };
}
export {
  T as useTokenBalances
};

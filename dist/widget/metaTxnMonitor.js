import { useQueries as c } from "./node_modules/.pnpm/@tanstack_react-query@5.80.5_react@19.1.0/node_modules/@tanstack/react-query/build/modern/useQueries.js";
import { useMemo as l } from "react";
const d = 3e3, y = async (r, u, i) => r.status(u, BigInt(i)), g = (r, u) => {
  const i = c({
    queries: (r || []).map((s) => {
      const n = s.id;
      return {
        queryKey: ["metaTxnStatus", s.chainId, s.id],
        queryFn: async () => {
          const a = u(parseInt(s.chainId));
          if (!n)
            return {
              status: "failed",
              reason: "Missing operation hash for monitoring."
            };
          if (!a)
            return {
              status: "failed",
              reason: `Relayer not available for chain ${s.chainId}.`
            };
          const t = await a.status(n, BigInt(s.chainId));
          let e;
          if (t.status === "confirmed")
            e = {
              status: "confirmed",
              transactionHash: t.transactionHash,
              data: t.data
            };
          else if (t.status === "failed")
            e = {
              status: "failed",
              reason: t.reason,
              data: t.data
            };
          else if (t.status === "pending")
            e = { status: "pending" };
          else if (t.status === "unknown")
            e = { status: "unknown" };
          else {
            const o = t.status;
            console.warn(`⚠️ Unexpected relayer status "${o}" for ${n}:`, t), e = { status: "unknown" };
          }
          return e;
        },
        refetchInterval: (a) => {
          const t = a.state.data;
          return t && t.status === "confirmed" ? !1 : d;
        },
        enabled: !!s && !!s.id && !!s.chainId,
        retry: (a, t) => a >= 30 ? (console.error(`❌ Giving up on transaction ${n} after 3 failed API attempts:`, t), !1) : !0
      };
    })
  });
  return l(() => {
    const s = {};
    return (r || []).forEach((n, a) => {
      var o;
      const t = `${n.chainId}-${n.id}`, e = i[a];
      e ? e.isLoading && e.fetchStatus !== "idle" && !e.data ? s[t] = { status: "pending" } : e.isError ? s[t] = {
        status: "failed",
        reason: ((o = e.error) == null ? void 0 : o.message) || "An unknown error occurred"
      } : e.data ? s[t] = e.data : s[t] = { status: "unknown" } : s[t] = {
        status: "failed",
        reason: "Query result unexpectedly missing"
      };
    }), s;
  }, [r, i]);
};
export {
  y as getMetaTxStatus,
  g as useMetaTxnsMonitor
};

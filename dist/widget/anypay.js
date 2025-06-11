import { useState as c, useEffect as N, useMemo as Ne } from "react";
import { useSwitchChain as hn, useSendTransaction as In, useEstimateGas as pn, useWaitForTransactionReceipt as vn } from "wagmi";
import { useQuery as wn } from "./node_modules/.pnpm/@tanstack_react-query@5.80.5_react@19.1.0/node_modules/@tanstack/react-query/build/modern/useQuery.js";
import { useMutation as Ee } from "./node_modules/.pnpm/@tanstack_react-query@5.80.5_react@19.1.0/node_modules/@tanstack/react-query/build/modern/useMutation.js";
import { zeroAddress as ge, isAddressEqual as Fe, createPublicClient as xe, http as he, createWalletClient as yn } from "viem";
import { useAPIClient as An } from "./apiClient.js";
import { useMetaTxnsMonitor as Tn, getMetaTxStatus as Be } from "./metaTxnMonitor.js";
import { relayerSendMetaTx as Oe } from "./metaTxns.js";
import { useRelayers as bn, getBackupRelayer as En } from "./relayer.js";
import { findPreconditionAddress as He } from "./preconditions.js";
import { calculateIntentAddress as Z, getIntentCallsPayloads as Sn, commitIntentConfig as xn, sendOriginTransaction as kn } from "./intents.js";
import { getERC20TransferData as Ue } from "./encoders.js";
import { base as Cn } from "./node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/base.js";
import { arbitrum as Mn } from "./node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/arbitrum.js";
import { optimism as Rn } from "./node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/optimism.js";
import { mainnet as $n } from "./node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/mainnet.js";
import { from as Se } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/Address.js";
const Pe = 1e4, ke = (W) => {
  switch (W) {
    case 1:
      return $n;
    case 10:
      return Rn;
    case 42161:
      return Mn;
    case 8453:
      return Cn;
    default:
      throw new Error(`Unsupported chain ID: ${W}`);
  }
};
function Qn(W) {
  const { account: a, disableAutoExecute: Ie = !1, env: ie, useV3Relayers: pe, sequenceApiKey: ve } = W, S = An({ projectAccessKey: ve }), [y, F] = c(!Ie), [re, ee] = c(!1), [U, ae] = c({}), [l, C] = c(null), [m, x] = c(null), [I, M] = c(
    null
  ), [i, j] = c(null), [p, K] = c(), [R, B] = c(null), [t, V] = c(null), [O, ce] = c({}), [T, _] = c(!1), [g, k] = c(!1), { switchChain: Ce, isPending: je, error: ne } = hn(), { sendTransaction: le, isPending: we } = In(), [qe, Me] = c(!1), [h, q] = c(null), [De, z] = c(null), [ye, de] = c({}), [D, G] = c(null), { getRelayer: ue } = bn({
    env: ie,
    useV3Relayers: pe
  }), {
    data: fe,
    isError: Ae,
    error: te
  } = pn(
    t != null && t.to && (t != null && t.chainId) && !t.error ? {
      to: t.to || void 0,
      data: t.data || void 0,
      value: t.value || void 0,
      chainId: t.chainId || void 0
    } : void 0
  ), v = Ee({
    mutationFn: async (e) => {
      if (!S) throw new Error("API client not available");
      if (!e.lifiInfos) throw new Error("LifiInfos not available");
      try {
        console.log("Calculating intent address..."), console.log("Main signer:", e.mainSigner), console.log("Calls:", e.calls), console.log("LifiInfos:", e.lifiInfos);
        const n = Z(
          e.mainSigner,
          e.calls,
          // TODO: Add proper type
          e.lifiInfos
          // TODO: Add proper type
        ), s = He(e.preconditions);
        console.log("Calculated address:", n.toString()), console.log("Received address:", s);
        const r = Fe(Se(s), n);
        if (G({
          success: r,
          receivedAddress: s,
          calculatedAddress: n.toString()
        }), !r)
          throw new Error("Address verification failed: Calculated address does not match received address.");
        const o = await S.commitIntentConfig({
          walletAddress: n.toString(),
          mainSigner: e.mainSigner,
          calls: e.calls,
          preconditions: e.preconditions,
          lifiInfos: e.lifiInfos
        });
        return console.log("API Commit Response:", o), { calculatedAddress: n.toString(), response: o };
      } catch (n) {
        if (console.error("Error during commit intent mutation:", n), !(D != null && D.success) && !(D != null && D.receivedAddress))
          try {
            const s = Z(
              e.mainSigner,
              e.calls,
              // TODO: Add proper type
              e.lifiInfos
              // TODO: Add proper type
            ), r = He(e.preconditions);
            G({
              success: !1,
              receivedAddress: r,
              calculatedAddress: s.toString()
            });
          } catch (s) {
            console.error("Error calculating addresses for verification status on failure:", s), G({ success: !1 });
          }
        throw n;
      }
    },
    onSuccess: (e) => {
      console.log("Intent config committed successfully, Wallet Address:", e.calculatedAddress), B(e.calculatedAddress);
    },
    onError: (e) => {
      console.error("Failed to commit intent config:", e), B(null);
    }
  }), {
    data: Ge,
    isLoading: Le,
    error: We
  } = wn({
    queryKey: ["getIntentConfig", R],
    queryFn: async () => {
      if (!S || !R)
        throw new Error("API client or committed intent address not available");
      return console.log("Fetching intent config for address:", R), await S.getIntentConfig({ walletAddress: R });
    },
    enabled: !!R && !!S && v.isSuccess,
    staleTime: 1e3 * 60 * 5,
    // 5 minutes
    retry: 1
  });
  async function Re(e) {
    return S.getIntentCallsPayloads(e);
  }
  const Q = Ee({
    mutationFn: async (e) => {
      if (!a.address)
        throw new Error("Missing selected token or account address");
      B(null), G(null);
      const n = await Re(e);
      return C(n.metaTxns), x(n.calls), M(n.preconditions), j(n.lifiInfos), B(null), G(null), n;
    },
    onSuccess: (e) => {
      console.log("Intent Config Success:", e), e && e.calls && e.calls.length > 0 && e.preconditions && e.preconditions.length > 0 && e.metaTxns && e.metaTxns.length > 0 ? (x(e.calls), M(e.preconditions), C(e.metaTxns), j(e.lifiInfos)) : (console.warn("API returned success but no operations found."), x(null), M(null), C(null), j(null));
    },
    onError: (e) => {
      console.error("Intent Config Error:", e), x(null), M(null), C(null), j(null);
    }
  });
  function Ke(e) {
    Q.mutate(e);
  }
  N(() => {
    a.isConnected || (x(null), M(null), C(null), B(null), G(null));
  }, [a.isConnected]);
  function Ve() {
    x(null), M(null), C(null), B(null), G(null), ce({}), ee(!1);
  }
  const H = (e, n, s, r, o) => {
    q({
      txnHash: e,
      status: n === "success" ? "Success" : n === "reverted" ? "Failed" : n === "sending" ? "Sending..." : "Pending",
      revertReason: n === "reverted" ? o || "Transaction reverted" : void 0,
      gasUsed: s ? Number(s) : void 0,
      effectiveGasPrice: r == null ? void 0 : r.toString()
    });
  }, _e = async () => {
    if (console.log("Sending origin transaction..."), console.log(
      T,
      t,
      t == null ? void 0 : t.error,
      t == null ? void 0 : t.to,
      t == null ? void 0 : t.data,
      t == null ? void 0 : t.value,
      t == null ? void 0 : t.chainId
    ), T || // Prevent duplicate transactions
    !t || t.error || !t.to || t.data === null || t.value === null || t.chainId === null) {
      console.error("Origin call parameters not available or invalid:", t), H(void 0, "reverted", void 0, void 0, "Origin call parameters not ready");
      return;
    }
    if (a.chainId !== t.chainId) {
      k(!0), H(
        void 0,
        "pending",
        void 0,
        void 0,
        `Switching to chain ${t.chainId}...`
      );
      try {
        console.log("Switching to chain:", t.chainId), await Ce({ chainId: t.chainId });
      } catch (e) {
        console.error("Failed to switch chain:", e), e instanceof Error && (e.message.includes("User rejected") || e.message.includes("user rejected")) && F(!1), H(
          void 0,
          "reverted",
          void 0,
          void 0,
          `Failed to switch chain: ${e instanceof Error ? e.message : "Unknown error"}`
        ), k(!1);
      }
      return;
    }
    if (T)
      console.warn("Transaction already in progress. Skipping duplicate request.");
    else {
      if (_(!0), K(void 0), H(void 0, "sending"), !fe && !Ae) {
        Me(!0);
        return;
      }
      if (Ae) {
        console.error("Gas estimation failed:", te), H(
          void 0,
          "reverted",
          void 0,
          void 0,
          `Gas estimation failed: ${te == null ? void 0 : te.message}`
        ), _(!1);
        return;
      }
      const e = fe ? BigInt(Math.floor(Number(fe) * 1.2)) : void 0;
      le(
        {
          to: t.to,
          data: t.data,
          value: t.value,
          chainId: t.chainId,
          gas: e
        },
        {
          onSuccess: (n) => {
            console.log("Transaction sent, hash:", n), K(n), _(!1);
          },
          onError: (n) => {
            console.error("Transaction failed:", n), n instanceof Error && (n.message.includes("User rejected") || n.message.includes("user rejected")) && F(!1), H(
              void 0,
              "reverted",
              void 0,
              void 0,
              n instanceof Error ? n.message : "Unknown error"
            ), _(!1);
          }
        }
      );
    }
  };
  N(() => {
    ne && (console.error("Chain switch error:", ne), H(
      void 0,
      "reverted",
      void 0,
      void 0,
      `Chain switch failed: ${ne.message || "Unknown error"}`
    ), k(!1));
  }, [ne]), N(() => {
    Me(!1);
  }, [t]), N(() => {
    t != null && t.chainId && a.chainId === t.chainId && k(!1);
  }, [a.chainId, t == null ? void 0 : t.chainId]);
  const {
    data: b,
    isLoading: Y,
    isSuccess: Te,
    isError: be,
    error: P
  } = vn({
    hash: p,
    confirmations: 1,
    query: {
      enabled: !!p
    }
  });
  N(() => {
    var e;
    if (!p) {
      h != null && h.txnHash && q(null), z(null), Object.keys(U).length > 0 && ae({});
      return;
    }
    if (!((h == null ? void 0 : h.txnHash) === p && ((h == null ? void 0 : h.status) === "Success" || (h == null ? void 0 : h.status) === "Failed") && !Y)) {
      if (Y) {
        q((n) => ({
          ...(n == null ? void 0 : n.txnHash) === p ? n : { gasUsed: void 0, effectiveGasPrice: void 0, revertReason: void 0 },
          txnHash: p,
          status: "Pending"
        }));
        return;
      }
      if (Te && b) {
        const n = b.status === "success" ? "Success" : "Failed";
        q({
          txnHash: b.transactionHash,
          status: n,
          gasUsed: b.gasUsed ? Number(b.gasUsed) : void 0,
          effectiveGasPrice: (e = b.effectiveGasPrice) == null ? void 0 : e.toString(),
          revertReason: b.status === "reverted" ? (P == null ? void 0 : P.message) || "Transaction reverted by receipt" : void 0
        }), n === "Success" && b.blockNumber ? (async () => {
          try {
            if (!(t != null && t.chainId)) {
              console.error("[AnyPay] Origin chainId not available for fetching origin block timestamp."), z(null);
              return;
            }
            const r = ke(t.chainId), w = await xe({
              chain: r,
              transport: he()
            }).getBlock({ blockNumber: BigInt(b.blockNumber) });
            z(Number(w.timestamp));
          } catch (r) {
            console.error("[AnyPay] Error fetching origin block timestamp:", r), z(null);
          }
        })() : n !== "Success" && z(null), n === "Success" && l && l.length > 0 && y && !l.some((s) => U[`${s.chainId}-${s.id}`]) && (console.log("Origin transaction successful, auto-sending all meta transactions..."), J.mutate({ selectedId: null }));
      } else be && (q({
        txnHash: p,
        status: "Failed",
        revertReason: (P == null ? void 0 : P.message) || "Failed to get receipt",
        gasUsed: void 0,
        effectiveGasPrice: void 0
      }), z(null));
    }
  }, [
    p,
    Y,
    Te,
    be,
    b,
    P,
    l,
    U,
    y,
    t == null ? void 0 : t.chainId
  ]), N(() => {
    y && v.isSuccess && (t == null ? void 0 : t.chainId) && a.chainId === t.chainId && !t.error && t.to && t.data !== null && t.value !== null && !we && !Y && !p && !g && !h && !re && (console.log("Auto-executing transaction: All conditions met."), ee(!0), q({
      status: "Sending..."
    }), le(
      {
        to: t.to,
        data: t.data,
        value: t.value,
        chainId: t.chainId
      },
      {
        onSuccess: (n) => {
          console.log("Auto-executed transaction sent, hash:", n), K(n);
        },
        onError: (n) => {
          console.error("Auto-executed transaction failed:", n), n instanceof Error && (n.message.includes("User rejected") || n.message.includes("user rejected")) && F(!1), q({
            status: "Failed",
            revertReason: n instanceof Error ? n.message : "Unknown error"
          }), ee(!1);
        }
      }
    ));
  }, [
    y,
    v.isSuccess,
    t,
    a.chainId,
    we,
    Y,
    p,
    g,
    h,
    re,
    le
  ]), N(() => {
    y && m && I && i && a.address && me && !v.isPending && !v.isSuccess && (console.log("Auto-committing intent configuration..."), v.mutate({
      walletAddress: me.toString(),
      mainSigner: a.address,
      calls: m,
      preconditions: I,
      lifiInfos: i
    }));
  }, [
    y,
    m,
    I,
    i,
    // Add lifiInfos dependency
    a.address,
    v,
    v.isPending,
    v.isSuccess
  ]);
  const J = Ee({
    mutationFn: async ({ selectedId: e }) => {
      if (!m || !I || !l || !a.address || !i)
        throw new Error("Missing required data for meta-transaction");
      const n = Z(a.address, m, i), s = e ? [l.find((o) => o.id === e)] : l;
      if (!s || e && !s[0])
        throw new Error("Meta transaction not found");
      const r = [];
      for (const o of s) {
        if (!o) continue;
        const w = `${o.chainId}-${o.id}`, $ = U[w], A = Date.now();
        if ($ && A - $ < Pe) {
          const d = Math.ceil((Pe - (A - $)) / 1e3);
          console.log(`Meta transaction for ${w} was sent recently. Wait ${d}s before retry`);
          continue;
        }
        try {
          const d = parseInt(o.chainId);
          if (isNaN(d) || d <= 0)
            throw new Error(`Invalid chainId for meta transaction: ${d}`);
          const L = ue(d);
          if (!L)
            throw new Error(`No relayer found for chainId: ${d}`);
          const u = I.filter((f) => f.chainId && parseInt(f.chainId) === d);
          console.log(`Relaying meta transaction ${w} to intent ${n} via relayer:`, L);
          const { opHash: E } = await L.sendMetaTxn(
            o.walletAddress,
            o.contract,
            o.input,
            BigInt(o.chainId),
            void 0,
            u
          );
          try {
            const f = En(d);
            f == null || f.sendMetaTxn(
              o.walletAddress,
              o.contract,
              o.input,
              BigInt(o.chainId),
              void 0,
              u
            ).then(() => {
            }).catch(() => {
            });
          } catch {
          }
          r.push({
            operationKey: w,
            opHash: E,
            success: !0
          });
        } catch (d) {
          r.push({
            operationKey: w,
            error: d instanceof Error ? d.message : "Unknown error",
            success: !1
          });
        }
      }
      return r;
    },
    onSuccess: (e) => {
      e.forEach(({ operationKey: n, opHash: s, success: r }) => {
        r && s && (ae((o) => ({
          ...o,
          [n]: Date.now()
        })), ce((o) => ({
          ...o,
          [n]: s
        })));
      });
    },
    onError: (e) => {
      console.error("Error in meta-transaction process:", e);
    },
    retry: 5,
    // Allow up to 2 retries
    retryDelay: (e) => Math.min(1e3 * Math.pow(2, e), 3e4)
    // Exponential backoff
  }), [se, ze] = c(null), [oe, Qe] = c(null);
  N(() => {
    var e, n, s, r;
    if (!((e = m == null ? void 0 : m[0]) != null && e.chainId) || !se || !oe || !I || !a.address) {
      V(null);
      return;
    }
    try {
      const o = me;
      let w, $ = "0x", A = 0n;
      const d = o;
      if (se === ge) {
        const u = I.find(
          (f) => (f.type === "transfer-native" || f.type === "native-balance") && f.chainId === oe.toString()
        ), E = ((n = u == null ? void 0 : u.data) == null ? void 0 : n.minAmount) ?? ((s = u == null ? void 0 : u.data) == null ? void 0 : s.min);
        if (E === void 0)
          throw new Error("Could not find native precondition (transfer-native or native-balance) or min amount");
        A = BigInt(E), w = d;
      } else {
        const u = I.find(
          (f) => {
            var $e;
            return f.type === "erc20-balance" && f.chainId === oe.toString() && (($e = f.data) == null ? void 0 : $e.token) && Fe(Se(f.data.token), Se(se));
          }
        ), E = (r = u == null ? void 0 : u.data) == null ? void 0 : r.min;
        if (E === void 0)
          throw new Error("Could not find ERC20 balance precondition or min amount");
        $ = Ue(d, E), w = se;
      }
      V({
        to: w,
        data: $,
        value: A,
        chainId: oe,
        error: void 0
      });
    } catch (o) {
      console.error("Failed to calculate origin call params for UI:", o), V({
        to: null,
        data: null,
        value: null,
        chainId: null,
        error: o instanceof Error ? o.message : "Unknown error"
      });
    }
  }, [m, se, oe, I, a.address, i]);
  const X = Tn(l, ue), Ye = Ne(() => !l || Object.keys(X).length === 0 ? "no_statuses" : l.map((n) => `${n.chainId}-${n.id}`).sort().map((n) => {
    const s = X[n];
    return `${n}:${s ? s.status : "loading"}`;
  }).join(","), [l, X]);
  N(() => {
    l && Object.keys(X).length > 0 && l.forEach(async (e) => {
      var w, $;
      const n = `${e.chainId}-${e.id}`, s = X[n];
      if ((w = ye[n]) != null && w.timestamp || ($ = ye[n]) != null && $.error)
        return;
      let r, o;
      if ((s == null ? void 0 : s.status) === "confirmed" && (o = s.transactionHash), o)
        try {
          const A = parseInt(e.chainId);
          if (isNaN(A) || A <= 0)
            throw console.error(`[AnyPay] MetaTxn ${n}: Invalid chainId:`, e.chainId), new Error(`Invalid chainId for meta transaction: ${e.chainId}`);
          const d = ke(A), L = xe({
            chain: d,
            transport: he()
          }), u = await L.getTransactionReceipt({ hash: o });
          if (u && typeof u.blockNumber == "bigint")
            r = u.blockNumber;
          else {
            console.warn(
              `[AnyPay] MetaTxn ${n}: Block number not found or invalid in fetched receipt:`,
              u
            ), de((E) => ({
              ...E,
              [n]: { timestamp: null, error: "Block number not found in receipt" }
            }));
            return;
          }
          if (r !== void 0) {
            const E = await L.getBlock({ blockNumber: r });
            de((f) => ({
              ...f,
              [n]: { timestamp: Number(E.timestamp), error: void 0 }
            }));
          }
        } catch (A) {
          console.error(
            `[AnyPay] MetaTxn ${n}: Error fetching transaction receipt or block timestamp:`,
            A
          ), de((d) => ({
            ...d,
            [n]: { timestamp: null, error: A.message || "Failed to fetch receipt/timestamp" }
          }));
        }
      else (s == null ? void 0 : s.status) === "confirmed" && console.log(
        `[AnyPay] MetaTxn ${n}: Status is confirmed, but transactionHashForReceipt is undefined. Not fetching timestamp.`
      );
    }), (!l || l.length === 0) && de((e) => Object.keys(e).length === 0 ? e : {});
  }, [Ye, ue]);
  const Je = (e) => {
    F(e);
  };
  function Xe(e) {
    Q.mutate(e);
  }
  const me = Ne(() => !a.address || !m || !i ? null : Z(a.address, m, i), [a.address, m, i]), Ze = Q.isPending, en = Q.isSuccess, nn = Q.error, tn = Q.variables;
  function sn(e) {
    console.log("commitIntentConfig", e), v.mutate(e);
  }
  function on(e) {
    if (!e) {
      V(null);
      return;
    }
    const { originChainId: n, tokenAddress: s } = e;
    Qe(n), ze(s);
  }
  function rn(e) {
    J.mutate({ selectedId: e });
  }
  const an = v.isPending, cn = v.isSuccess, ln = v.error, dn = v.variables, un = J.isPending, fn = J.isSuccess, mn = J.error, gn = J.variables;
  return {
    apiClient: S,
    metaTxns: l,
    intentCallsPayloads: m,
    intentPreconditions: I,
    lifiInfos: i,
    txnHash: p,
    committedIntentAddress: R,
    verificationStatus: D,
    getRelayer: ue,
    estimatedGas: fe,
    isEstimateError: Ae,
    estimateError: te,
    calculateIntentAddress: Z,
    committedIntentConfig: Ge,
    isLoadingCommittedConfig: Le,
    committedConfigError: We,
    commitIntentConfig: sn,
    commitIntentConfigPending: an,
    commitIntentConfigSuccess: cn,
    commitIntentConfigError: ln,
    commitIntentConfigArgs: dn,
    getIntentCallsPayloads: Re,
    operationHashes: O,
    callIntentCallsPayload: Ke,
    sendOriginTransaction: _e,
    switchChain: Ce,
    isSwitchingChain: je,
    switchChainError: ne,
    isTransactionInProgress: T,
    isChainSwitchRequired: g,
    sendTransaction: le,
    isSendingTransaction: we,
    originCallStatus: h,
    updateOriginCallStatus: H,
    isEstimatingGas: qe,
    isAutoExecute: y,
    updateAutoExecute: Je,
    receipt: b,
    isWaitingForReceipt: Y,
    receiptIsSuccess: Te,
    receiptIsError: be,
    receiptError: P,
    hasAutoExecuted: re,
    sentMetaTxns: U,
    sendMetaTxn: rn,
    sendMetaTxnPending: un,
    sendMetaTxnSuccess: fn,
    sendMetaTxnError: mn,
    sendMetaTxnArgs: gn,
    clearIntent: Ve,
    metaTxnMonitorStatuses: X,
    createIntent: Xe,
    createIntentPending: Ze,
    createIntentSuccess: en,
    createIntentError: nn,
    createIntentArgs: tn,
    calculatedIntentAddress: me,
    originCallParams: t,
    updateOriginCallParams: on,
    originBlockTimestamp: De,
    metaTxnBlockTimestamps: ye
  };
}
async function Yn(W) {
  var p, K, R;
  const {
    account: a,
    originTokenAddress: Ie,
    originChainId: ie,
    originTokenAmount: pe,
    // account balance
    destinationChainId: ve,
    recipient: S,
    destinationTokenAddress: y,
    destinationTokenAmount: F,
    sequenceApiKey: re,
    fee: ee,
    client: U,
    dryMode: ae,
    apiClient: l,
    originRelayer: C,
    destinationRelayer: m
  } = W, x = ke(ie), I = a.address, M = {
    userAddress: I,
    originChainId: ie,
    originTokenAddress: Ie,
    originTokenAmount: pe,
    // max amount
    destinationChainId: ve,
    destinationToAddress: y == ge ? S : y,
    destinationTokenAddress: y,
    destinationTokenAmount: F,
    destinationCallData: y !== ge ? Ue(S, BigInt(F)) : "0x",
    destinationCallValue: y === ge ? F : "0"
  };
  console.log("Creating intent with args:", M);
  const i = await Sn(l, M);
  if (console.log("Got intent:", i), !i)
    throw new Error("Invalid intent");
  if (!((p = i.preconditions) != null && p.length) || !((K = i.calls) != null && K.length) || !((R = i.lifiInfos) != null && R.length))
    throw new Error("Invalid intent");
  const j = Z(I, i.calls, i.lifiInfos);
  return console.log("Calculated intent address:", j.toString()), await xn(
    l,
    I,
    i.calls,
    i.preconditions,
    i.lifiInfos
  ), console.log("Committed intent config"), {
    intentAddress: j,
    send: async () => {
      console.log("sending origin transaction");
      const B = {
        to: i.preconditions[0].data.address,
        data: "0x",
        value: BigInt(i.preconditions[0].data.min) + BigInt(ee),
        chain: x
      }, t = U ?? yn({
        chain: x,
        transport: he()
      }), V = xe({
        chain: x,
        transport: he()
      });
      if (!ae) {
        const g = await kn(a, t, B);
        console.log("origin tx", g);
        const k = await V.waitForTransactionReceipt({ hash: g });
        console.log("receipt", k);
      }
      await new Promise((g) => setTimeout(g, 5e3));
      const O = i.metaTxns[0];
      console.log("metaTx", O);
      const ce = await Oe(C, O, [i.preconditions[0]]);
      for (console.log("opHash", ce); ; ) {
        console.log("polling status", O.id, BigInt(O.chainId));
        const g = await Be(C, O.id, Number(O.chainId));
        if (console.log("status", g), g.status === "confirmed")
          break;
        await new Promise((k) => setTimeout(k, 1e3));
      }
      await new Promise((g) => setTimeout(g, 5e3));
      const T = i.metaTxns[1];
      console.log("metaTx2", T);
      const _ = await Oe(m, T, [i.preconditions[1]]);
      for (console.log("opHash2", _); ; ) {
        console.log("polling status", T.id, BigInt(T.chainId));
        const g = await Be(m, T.id, Number(T.chainId));
        if (console.log("receipt", g), g.status === "confirmed")
          break;
        await new Promise((k) => setTimeout(k, 1e3));
      }
    }
  };
}
export {
  ke as getChainConfig,
  Yn as prepareSend,
  Qn as useAnyPay
};

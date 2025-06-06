import { j as s } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import { useState as A, useMemo as C } from "react";
import { useAccount as U } from "wagmi";
import { useTokenBalances as k } from "../../tokenBalances.js";
import { zeroAddress as y, formatUnits as H, isAddressEqual as D } from "viem";
import { TokenImage as q, NetworkImage as F } from "@0xsequence/design-system";
import * as O from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/index.js";
import z from "../../node_modules/.pnpm/lucide-react@0.493.0_react@19.1.0/node_modules/lucide-react/dist/esm/icons/search.js";
import M from "../../node_modules/.pnpm/lucide-react@0.493.0_react@19.1.0/node_modules/lucide-react/dist/esm/icons/arrow-left.js";
import { from as I } from "../../node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/Address.js";
const Q = ["ETH", "WETH", "USDC", "USDT", "DAI", "OP", "ARB", "MATIC", "XDAI", "AVAX", "BNB", "OKB"], v = (d) => Object.values(O).find((m) => m.id === d) || null, R = (d, m = 18) => {
  try {
    const u = H(BigInt(d), m), a = parseFloat(u);
    return a === 0 ? "0" : a < 1e-4 ? a.toExponential(2) : a < 1 ? a.toFixed(6) : a < 1e3 ? a.toFixed(4) : a.toLocaleString(void 0, { maximumFractionDigits: 2 });
  } catch (u) {
    return console.error("Error formatting balance:", u), d;
  }
}, _ = ({ onContinue: d, onBack: m, indexerGatewayClient: u }) => {
  const [a, S] = A(null), [x, E] = A(""), { address: L } = U(), {
    sortedTokens: N,
    isLoadingBalances: j,
    balanceError: f
  } = k(L, u), p = C(() => N.filter((e) => {
    var t;
    return !e.contractAddress || Q.includes(((t = e.contractInfo) == null ? void 0 : t.symbol) || "");
  }), [N]), B = (e) => {
    var l, i;
    const t = !("contractAddress" in e), r = v(e.chainId), n = t ? y : e.contractAddress, c = `https://assets.sequence.info/images/tokens/small/${e.chainId}/${n}.webp`;
    let o;
    t ? o = {
      id: e.chainId,
      name: (r == null ? void 0 : r.nativeCurrency.name) || "Native Token",
      symbol: (r == null ? void 0 : r.nativeCurrency.symbol) || "ETH",
      balance: e.balance,
      imageUrl: c,
      chainId: e.chainId,
      contractAddress: y,
      contractInfo: {
        decimals: 18,
        symbol: (r == null ? void 0 : r.nativeCurrency.symbol) || "ETH",
        name: (r == null ? void 0 : r.nativeCurrency.name) || "Native Token"
      }
    } : o = {
      id: e.chainId,
      name: ((l = e.contractInfo) == null ? void 0 : l.name) || "Unknown Token",
      symbol: ((i = e.contractInfo) == null ? void 0 : i.symbol) || "???",
      balance: e.balance,
      imageUrl: c,
      chainId: e.chainId,
      contractAddress: e.contractAddress,
      contractInfo: e.contractInfo
    }, S(o);
  }, $ = (e) => {
    if (!a) return !1;
    const t = !("contractAddress" in e);
    return a.chainId === e.chainId && (t ? a.contractAddress === y : D(I(a.contractAddress), I(e.contractAddress)));
  }, w = C(() => {
    if (!x.trim())
      return p;
    const e = x.toLowerCase().trim();
    return p.filter((t) => {
      var o, l, i, b;
      const r = !("contractAddress" in t), n = v(t.chainId), c = (n == null ? void 0 : n.name) || "";
      if (r) {
        const h = (n == null ? void 0 : n.nativeCurrency.symbol) || "ETH", g = (n == null ? void 0 : n.nativeCurrency.name) || "Native Token";
        return h.toLowerCase().includes(e) || g.toLowerCase().includes(e) || c.toLowerCase().includes(e);
      }
      return ((l = (o = t.contractInfo) == null ? void 0 : o.symbol) == null ? void 0 : l.toLowerCase().includes(e)) || ((b = (i = t.contractInfo) == null ? void 0 : i.name) == null ? void 0 : b.toLowerCase().includes(e)) || c.toLowerCase().includes(e);
    });
  }, [p, x]);
  return /* @__PURE__ */ s.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ s.jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Select Token" }),
    /* @__PURE__ */ s.jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ s.jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: /* @__PURE__ */ s.jsx(z, { className: "h-5 w-5 text-gray-400" }) }),
      /* @__PURE__ */ s.jsx(
        "input",
        {
          type: "text",
          value: x,
          onChange: (e) => E(e.target.value),
          placeholder: "Search by token name, symbol, or chain...",
          className: "block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
        }
      )
    ] }),
    j && /* @__PURE__ */ s.jsxs("div", { className: "text-center py-4", children: [
      /* @__PURE__ */ s.jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" }),
      /* @__PURE__ */ s.jsx("p", { className: "mt-2 text-gray-500", children: "Loading your token balances..." })
    ] }),
    f && /* @__PURE__ */ s.jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: /* @__PURE__ */ s.jsxs("p", { className: "text-red-600", children: [
      "Error loading balances: ",
      f.message
    ] }) }),
    !j && !f && w.length === 0 && /* @__PURE__ */ s.jsx("div", { className: "text-center py-4 bg-gray-50 rounded-lg", children: /* @__PURE__ */ s.jsx("p", { className: "text-gray-500", children: x.trim() ? "No tokens found matching your search." : "No tokens found with balance greater than 0." }) }),
    /* @__PURE__ */ s.jsx("div", { className: "divide-y divide-gray-200 max-h-[40vh] overflow-y-auto rounded-lg", children: w.map((e) => {
      var h, g, T;
      const t = !("contractAddress" in e), r = v(e.chainId), n = (r == null ? void 0 : r.nativeCurrency.symbol) || "ETH", c = t ? n : ((h = e.contractInfo) == null ? void 0 : h.symbol) || "???", o = t ? y : e.contractAddress, l = `https://assets.sequence.info/images/tokens/small/${e.chainId}/${o}.webp`, i = t ? `${n} (${(r == null ? void 0 : r.name) || "Unknown Chain"})` : ((g = e.contractInfo) == null ? void 0 : g.name) || "Unknown Token", b = R(e.balance, t ? 18 : (T = e.contractInfo) == null ? void 0 : T.decimals);
      return /* @__PURE__ */ s.jsxs(
        "div",
        {
          onClick: () => B(e),
          className: `py-4 px-4 flex items-center space-x-4 cursor-pointer transition-colors ${$(e) ? "bg-blue-50" : "hover:bg-gray-50"}`,
          children: [
            /* @__PURE__ */ s.jsxs("div", { className: "relative flex-shrink-0", children: [
              /* @__PURE__ */ s.jsx("div", { className: "w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center", children: o ? /* @__PURE__ */ s.jsx(q, { symbol: c, src: l }) : /* @__PURE__ */ s.jsx("span", { className: "text-lg font-medium text-gray-600", children: c[0] }) }),
              /* @__PURE__ */ s.jsx("div", { className: "absolute -bottom-1 -right-1", children: /* @__PURE__ */ s.jsx(F, { chainId: e.chainId, size: "sm", className: "w-4 h-4" }) })
            ] }),
            /* @__PURE__ */ s.jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ s.jsx("h3", { className: "text-lg font-medium text-gray-900 truncate", children: i }),
              /* @__PURE__ */ s.jsx("p", { className: "text-sm text-gray-500", children: c })
            ] }),
            /* @__PURE__ */ s.jsxs("div", { className: "text-right flex-shrink-0", children: [
              /* @__PURE__ */ s.jsx("p", { className: "text-lg font-medium text-gray-900", children: b }),
              /* @__PURE__ */ s.jsx("p", { className: "text-sm text-gray-500", children: c })
            ] })
          ]
        },
        t ? `${e.chainId}-native` : `${e.chainId}-${e.contractAddress}`
      );
    }) }),
    /* @__PURE__ */ s.jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ s.jsx(
        "button",
        {
          onClick: () => a && d(a),
          disabled: !a,
          className: "w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors",
          children: "Continue"
        }
      ),
      /* @__PURE__ */ s.jsxs(
        "button",
        {
          onClick: m,
          className: "w-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 cursor-pointer font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center",
          children: [
            /* @__PURE__ */ s.jsx(M, { className: "h-5 w-5 mr-2" }),
            "Back"
          ]
        }
      )
    ] })
  ] });
};
export {
  _ as TokenList,
  _ as default
};

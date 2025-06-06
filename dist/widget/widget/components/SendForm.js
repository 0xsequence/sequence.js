import { j as e } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import { useState as i, useEffect as z, useRef as F } from "react";
import { TokenImage as N, NetworkImage as w } from "@0xsequence/design-system";
import * as te from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/index.js";
import { formatUnits as re, parseUnits as v, createWalletClient as ne, custom as oe, zeroAddress as P } from "viem";
import { getChainConfig as ie, prepareSend as ae } from "../../anypay.js";
import { getAPIClient as le } from "../../apiClient.js";
import { getRelayer as $ } from "../../relayer.js";
import { useEnsAddress as ce } from "wagmi";
import { mainnet as T } from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/mainnet.js";
import B from "../../node_modules/.pnpm/lucide-react@0.493.0_react@19.1.0/node_modules/lucide-react/dist/esm/icons/chevron-down.js";
import de from "../../node_modules/.pnpm/lucide-react@0.493.0_react@19.1.0/node_modules/lucide-react/dist/esm/icons/loader-circle.js";
import { base as me } from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/base.js";
import { optimism as ue } from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/optimism.js";
import { arbitrum as fe } from "../../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/arbitrum.js";
const C = [
  { id: 1, name: "Ethereum", icon: T.id },
  { id: 8453, name: "Base", icon: me.id },
  { id: 10, name: "Optimism", icon: ue.id },
  { id: 42161, name: "Arbitrum", icon: fe.id }
], H = [
  {
    symbol: "ETH",
    name: "Ethereum",
    imageUrl: "https://assets.sequence.info/images/tokens/small/1/0x0000000000000000000000000000000000000000.webp"
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    imageUrl: "https://assets.sequence.info/images/tokens/small/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.webp"
  }
], be = (s) => Object.values(te).find((r) => r.id === s) || null, pe = (s, r = 18) => {
  try {
    const m = re(BigInt(s), r), o = parseFloat(m);
    return o === 0 ? "0" : o < 1e-4 ? o.toExponential(2) : o < 1 ? o.toFixed(6) : o < 1e3 ? o.toFixed(4) : o.toLocaleString(void 0, { maximumFractionDigits: 2 });
  } catch (m) {
    return console.error("Error formatting balance:", m), s;
  }
};
function xe(s, r) {
  if (r === "ETH")
    return P;
  if (s === 10 && r === "USDC")
    return "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
  if (s === 42161 && r === "USDC")
    return "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  if (s === 8453 && r === "USDC")
    return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  throw new Error(`Unsupported token symbol: ${r} for chainId: ${s}`);
}
const ze = ({
  selectedToken: s,
  onSend: r,
  onBack: m,
  onConfirm: o,
  onComplete: L,
  account: D,
  sequenceApiKey: I,
  apiUrl: W,
  env: A
}) => {
  var k;
  const [c, q] = i(""), [a, V] = i(""), [u, E] = i(""), {
    data: f,
    isLoading: he,
    error: ye
  } = ce({
    name: a.endsWith(".eth") ? a : void 0,
    chainId: T.id,
    query: {
      enabled: !!a && a.endsWith(".eth")
    }
  });
  z(() => {
    E(f || a);
  }, [f, a]);
  const _ = (t) => {
    V(t.target.value.trim());
  }, [l, K] = i(
    () => C.find((t) => t.id === s.chainId) || C[0]
  ), [b, p] = i(!1), [x, g] = i(!1), [n, M] = i(H[0]), h = F(null), y = F(null), j = be(s.chainId), [S, R] = i(!1), G = pe(s.balance, (k = s.contractInfo) == null ? void 0 : k.decimals);
  z(() => {
    const t = (d) => {
      h.current && !h.current.contains(d.target) && p(!1), y.current && !y.current.contains(d.target) && g(!1);
    };
    return document.addEventListener("mousedown", t), () => document.removeEventListener("mousedown", t);
  }, []);
  const U = async (t) => {
    t.preventDefault();
    try {
      R(!0);
      const d = n.symbol === "ETH" ? 18 : 6, J = v(c, d).toString(), Q = ne({
        account: D,
        chain: ie(s.chainId),
        transport: oe(window.ethereum)
      });
      console.log("selectedDestToken.symbol", n);
      const X = le({ apiUrl: W, projectAccessKey: I }), Y = $({ env: A, useV3Relayers: !0 }, s.chainId), Z = $({ env: A, useV3Relayers: !0 }, l.id), O = {
        account: D,
        originTokenAddress: s.contractAddress,
        originChainId: s.chainId,
        originTokenAmount: s.balance,
        destinationChainId: l.id,
        recipient: u,
        destinationTokenAddress: n.symbol === "ETH" ? P : xe(l.id, n.symbol),
        destinationTokenAmount: J,
        sequenceApiKey: I,
        fee: s.symbol === "ETH" ? v("0.0001", 18).toString() : v("0.02", 6).toString(),
        // TOOD: fees
        client: Q,
        apiClient: X,
        originRelayer: Y,
        destinationRelayer: Z,
        dryMode: !1
        // Set to true to skip the metamask transaction, for testing purposes
      };
      console.log("options", O);
      const { intentAddress: ee, send: se } = await ae(O);
      console.log("Intent address:", ee.toString()), r(c, u), se().then(() => {
        L();
      }), setTimeout(() => {
        o();
      }, 1e4);
    } catch (d) {
      console.error("Error in prepareSend:", d), R(!1);
    }
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ e.jsxs("div", { className: "flex items-center space-x-4 bg-gray-50 p-4 rounded-lg", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ e.jsx("div", { className: "w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center", children: s.contractAddress ? /* @__PURE__ */ e.jsx(N, { symbol: s.symbol, src: s.imageUrl }) : /* @__PURE__ */ e.jsx("span", { className: "text-2xl font-medium text-gray-600", children: s.symbol[0] }) }),
        /* @__PURE__ */ e.jsx("div", { className: "absolute -bottom-1 -right-1", children: /* @__PURE__ */ e.jsx(w, { chainId: s.chainId, size: "sm", className: "w-6 h-6" }) })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { children: [
        /* @__PURE__ */ e.jsxs("h3", { className: "text-lg font-medium text-gray-900", children: [
          "From: ",
          s.name
        ] }),
        /* @__PURE__ */ e.jsxs("p", { className: "text-sm text-gray-500", children: [
          "on ",
          (j == null ? void 0 : j.name) || "Unknown Chain",
          " • Balance: ",
          G,
          " ",
          s.symbol
        ] })
      ] })
    ] }),
    /* @__PURE__ */ e.jsxs("form", { onSubmit: U, className: "space-y-6", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ e.jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Destination Chain" }),
        /* @__PURE__ */ e.jsxs("div", { className: "relative", ref: h, children: [
          /* @__PURE__ */ e.jsxs(
            "button",
            {
              type: "button",
              onClick: () => p(!b),
              className: "w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              children: [
                /* @__PURE__ */ e.jsx(w, { chainId: l.icon, size: "sm", className: "w-5 h-5" }),
                /* @__PURE__ */ e.jsx("span", { className: "ml-2 flex-1 text-left text-gray-900", children: l.name }),
                /* @__PURE__ */ e.jsx(
                  B,
                  {
                    className: `h-5 w-5 text-gray-400 transition-transform ${b ? "transform rotate-180" : ""}`
                  }
                )
              ]
            }
          ),
          b && /* @__PURE__ */ e.jsx("div", { className: "absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg", children: C.map((t) => /* @__PURE__ */ e.jsxs(
            "button",
            {
              type: "button",
              onClick: () => {
                K(t), p(!1);
              },
              className: `w-full flex items-center px-4 py-3 hover:bg-gray-50 ${l.id === t.id ? "bg-blue-50 text-blue-600" : "text-gray-900"}`,
              children: [
                /* @__PURE__ */ e.jsx(w, { chainId: t.icon, size: "sm", className: "w-5 h-5" }),
                /* @__PURE__ */ e.jsx("span", { className: "ml-2", children: t.name }),
                l.id === t.id && /* @__PURE__ */ e.jsx("span", { className: "ml-auto text-blue-600", children: "•" })
              ]
            },
            t.id
          )) })
        ] })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ e.jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Receive Token" }),
        /* @__PURE__ */ e.jsxs("div", { className: "relative", ref: y, children: [
          /* @__PURE__ */ e.jsxs(
            "button",
            {
              type: "button",
              onClick: () => g(!x),
              className: "w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              children: [
                /* @__PURE__ */ e.jsx("div", { className: "w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm", children: /* @__PURE__ */ e.jsx(N, { symbol: n.symbol, src: n.imageUrl, size: "sm" }) }),
                /* @__PURE__ */ e.jsx("span", { className: "ml-2 flex-1 text-left text-gray-900", children: n.name }),
                /* @__PURE__ */ e.jsx(
                  B,
                  {
                    className: `h-5 w-5 text-gray-400 transition-transform ${x ? "transform rotate-180" : ""}`
                  }
                )
              ]
            }
          ),
          x && /* @__PURE__ */ e.jsx("div", { className: "absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg", children: H.map((t) => /* @__PURE__ */ e.jsxs(
            "button",
            {
              type: "button",
              onClick: () => {
                M(t), g(!1);
              },
              className: `w-full flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${n.symbol === t.symbol ? "bg-blue-50 text-blue-600" : "text-gray-900"}`,
              children: [
                /* @__PURE__ */ e.jsx("div", { className: "w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm", children: /* @__PURE__ */ e.jsx(N, { symbol: t.symbol, src: t.imageUrl, size: "sm" }) }),
                /* @__PURE__ */ e.jsx("span", { className: "ml-2", children: t.name }),
                n.symbol === t.symbol && /* @__PURE__ */ e.jsx("span", { className: "ml-auto text-blue-600", children: "•" })
              ]
            },
            t.symbol
          )) })
        ] })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ e.jsx("div", { className: "flex justify-between items-center", children: /* @__PURE__ */ e.jsx("label", { htmlFor: "amount", className: "block text-sm font-medium text-gray-700", children: "Amount to Receive" }) }),
        /* @__PURE__ */ e.jsxs("div", { className: "relative rounded-lg", children: [
          /* @__PURE__ */ e.jsx(
            "input",
            {
              id: "amount",
              type: "text",
              value: c,
              onChange: (t) => q(t.target.value),
              placeholder: "0.00",
              className: "block w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 text-lg"
            }
          ),
          /* @__PURE__ */ e.jsx("div", { className: "absolute inset-y-0 right-0 flex items-center pr-4", children: /* @__PURE__ */ e.jsx("span", { className: "text-gray-500", children: n.symbol }) })
        ] })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ e.jsx("label", { htmlFor: "recipient", className: "block text-sm font-medium text-gray-700", children: "Recipient Address" }),
        /* @__PURE__ */ e.jsx(
          "input",
          {
            id: "recipient",
            type: "text",
            value: a,
            onChange: _,
            placeholder: "0x...",
            className: "block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 font-mono text-sm"
          }
        ),
        f ? /* @__PURE__ */ e.jsx("p", { className: "text-sm text-gray-500", children: u }) : null
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col space-y-3", children: [
        /* @__PURE__ */ e.jsx(
          "button",
          {
            type: "submit",
            disabled: !c || !u || S,
            className: "w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 cursor-pointer disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors relative",
            onClick: U,
            children: S ? /* @__PURE__ */ e.jsxs("div", { className: "flex items-center justify-center", children: [
              /* @__PURE__ */ e.jsx(de, { className: "w-5 h-5 animate-spin mr-2" }),
              /* @__PURE__ */ e.jsx("span", { children: "Processing..." })
            ] }) : `Receive ${c ? `${c} ${n.symbol}` : ""}`
          }
        ),
        /* @__PURE__ */ e.jsx(
          "button",
          {
            type: "button",
            onClick: m,
            className: "w-full border border-gray-300 hover:border-gray-400 cursor-pointer text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors",
            children: "Back"
          }
        )
      ] })
    ] })
  ] });
}, ge = `
  select {
    appearance: none;
    border: 1px solid #e5e7eb;
    outline: none;
    font-size: 1rem;
    width: 100%;
    background-color: #fff;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    padding-right: 2rem;
    
    cursor: pointer;
    transition: all 0.2s;
  }

  select:hover {
    border-color: #d1d5db;
  }

  select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  select option {
    padding: 0.75rem 1rem;
    min-height: 3rem;
    display: flex;
    align-items: center;
    padding-left: 2.75rem;
    position: relative;
    cursor: pointer;
  }

  select option:hover {
    background-color: #f3f4f6;
  }

  select option:checked {
    background-color: #eff6ff;
    color: #1d4ed8;
  }
`;
if (typeof document < "u") {
  const s = document.createElement("style");
  s.textContent = ge, document.head.appendChild(s);
}
export {
  ze as SendForm,
  ze as default
};

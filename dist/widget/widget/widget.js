import { j as e } from "../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import { StrictMode as _, useState as c } from "react";
import { createConfig as D, http as G, WagmiProvider as O, useAccount as R } from "wagmi";
import { SequenceHooksProvider as U } from "../node_modules/.pnpm/@0xsequence_hooks@5.3.4_@0xsequence_api@0.0.0-anypay-20250527101311_@0xsequence_indexer_6fbf5f279950ca81bf6956be6ad27908/node_modules/@0xsequence/hooks/dist/esm/contexts/ConfigContext.js";
import "@0xsequence/api";
import { QueryClient as F } from "../node_modules/.pnpm/@tanstack_query-core@5.80.5/node_modules/@tanstack/query-core/build/modern/queryClient.js";
import { QueryClientProvider as N } from "../node_modules/.pnpm/@tanstack_react-query@5.80.5_react@19.1.0/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js";
import "../node_modules/.pnpm/@0xsequence_network@2.3.17_ethers@6.13.5_bufferutil@4.0.9_utf-8-validate@5.0.10_/node_modules/@0xsequence/network/dist/0xsequence-network.esm.js";
import { createWalletClient as k, custom as g } from "viem";
import { Modal as B } from "./components/Modal.js";
import { ConnectWallet as H } from "./components/ConnectWallet.js";
import { TokenList as Q } from "./components/TokenList.js";
import { SendForm as V } from "./components/SendForm.js";
import { TransferPending as X } from "./components/TransferPending.js";
import { Receipt as Y } from "./components/Receipt.js";
import * as y from "../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/index.js";
/* empty css                                                                                                                                                                                                   */
/* empty css          */
import { DEFAULT_API_URL as $, DEFAULT_INDEXER_GATEWAY_URL as q, DEFAULT_ENV as z } from "../constants.js";
import { useIndexerGatewayClient as J } from "../indexerClient.js";
import { metaMask as K } from "../node_modules/.pnpm/@wagmi_connectors@5.8.4_@types_react@19.1.6_@wagmi_core@2.17.2_@tanstack_query-core@5.8_67e6e3b4ad41e05527df426f9cf989bf/node_modules/@wagmi/connectors/dist/esm/metaMask.js";
import { arbitrum as Z } from "../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/arbitrum.js";
import { optimism as ee } from "../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/optimism.js";
import { base as ne } from "../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/base.js";
import { mainnet as te } from "../node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/definitions/mainnet.js";
import { injected as oe } from "../node_modules/.pnpm/@wagmi_core@2.17.2_@tanstack_query-core@5.80.5_@types_react@19.1.6_react@19.1.0_typescr_4f72fe994b45c490350d5701a857bfba/node_modules/@wagmi/core/dist/esm/connectors/injected.js";
const re = D({
  // @ts-expect-error
  chains: Object.values(y),
  connectors: [
    // sequenceWallet({
    //   connectOptions: {
    //     app: 'Demo Anypay',
    //     projectAccessKey: projectAccessKey,
    //   },
    //   defaultNetwork: chains.mainnet.id,
    // }),
    oe(),
    K()
  ],
  transports: Object.values(y).reduce(
    (n, o) => ({
      ...n,
      [o.id]: G()
    }),
    {}
  )
}), S = (n) => {
  switch (n) {
    case 1:
      return te;
    case 8453:
      return ne;
    case 10:
      return ee;
    case 42161:
      return Z;
    default:
      throw new Error(`Unsupported chain ID: ${n}`);
  }
}, se = new F(), ce = ({ sequenceApiKey: n, indexerUrl: o, apiUrl: i, env: d }) => {
  const { address: a, isConnected: ie, chainId: u } = R(), [b, p] = c(!1), [f, t] = c("connect"), [h, l] = c(null), [T, x] = c(""), [m, C] = c(null), A = J({
    indexerGatewayUrl: o,
    projectAccessKey: n
  }), E = () => {
    if (window.ethereum && a && u) {
      const r = S(u), s = k({
        account: a,
        chain: r,
        transport: g(window.ethereum)
      });
      C(s);
    }
    t("tokens");
  }, v = (r) => {
    if (window.ethereum && a) {
      const s = S(r.chainId), M = k({
        account: a,
        chain: s,
        transport: g(window.ethereum)
      });
      C(M);
    }
    l(r), t("send");
  }, P = async (r, s) => {
    console.log("handleSend", r, s);
  }, W = () => {
    t("receipt");
  }, I = () => {
    t("tokens");
  }, j = () => {
    p(!1), t("connect"), l(null), x("");
  }, w = () => {
    switch (f) {
      case "tokens":
        t("connect");
        break;
      case "send":
        t("tokens"), l(null);
        break;
      case "receipt":
        t("tokens"), l(null), x("");
        break;
    }
  }, L = () => {
    switch (f) {
      case "connect":
        return /* @__PURE__ */ e.jsx(H, { onConnect: E });
      case "tokens":
        return /* @__PURE__ */ e.jsx(Q, { onContinue: v, onBack: w, indexerGatewayClient: A });
      case "send":
        return h && (m != null && m.account) ? /* @__PURE__ */ e.jsx(
          V,
          {
            onSend: P,
            onBack: w,
            onConfirm: () => t("pending"),
            onComplete: () => t("receipt"),
            selectedToken: h,
            account: m.account,
            sequenceApiKey: n,
            apiUrl: i,
            env: d
          }
        ) : null;
      case "pending":
        return /* @__PURE__ */ e.jsx(X, { onComplete: W });
      case "receipt":
        return /* @__PURE__ */ e.jsx(Y, { onSendAnother: I, onClose: j, txHash: T });
      default:
        return null;
    }
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col items-center justify-center space-y-8 py-12", children: [
    /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: () => p(!0),
        className: "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors",
        children: "Pay"
      }
    ),
    /* @__PURE__ */ e.jsx(B, { isOpen: b, onClose: j, children: L() })
  ] });
}, Me = ({
  sequenceApiKey: n,
  indexerUrl: o = q,
  apiUrl: i = $,
  env: d = z
}) => /* @__PURE__ */ e.jsx(_, { children: /* @__PURE__ */ e.jsx(O, { config: re, children: /* @__PURE__ */ e.jsx(N, { client: se, children: /* @__PURE__ */ e.jsx(
  U,
  {
    config: {
      projectAccessKey: n,
      env: {
        indexerUrl: o,
        indexerGatewayUrl: o,
        apiUrl: i
      }
    },
    children: /* @__PURE__ */ e.jsx(ce, { sequenceApiKey: n, indexerUrl: o, apiUrl: i, env: d })
  }
) }) }) });
export {
  Me as AnyPayWidget,
  Me as default
};

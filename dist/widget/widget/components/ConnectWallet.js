import { j as e } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import { useConnect as d, useDisconnect as x, useAccount as m } from "wagmi";
import { injected as u } from "../../node_modules/.pnpm/@wagmi_core@2.17.2_@tanstack_query-core@5.80.5_@types_react@19.1.6_react@19.1.0_typescr_4f72fe994b45c490350d5701a857bfba/node_modules/@wagmi/core/dist/esm/connectors/injected.js";
const b = ({ onConnect: t }) => {
  const { connect: o } = d(), { disconnect: s } = x(), { isConnected: c, address: r, connector: n } = m(), l = async () => {
    try {
      await o({ connector: u() }), console.log("Connected to MetaMask");
    } catch (i) {
      console.error("Failed to connect:", i);
    }
  }, a = () => {
    s();
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ e.jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Connect a Wallet" }),
    c ? /* @__PURE__ */ e.jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "p-4 bg-gray-50 rounded-lg", children: [
        /* @__PURE__ */ e.jsxs("p", { className: "text-sm text-gray-500", children: [
          "Connected with ",
          n == null ? void 0 : n.name
        ] }),
        /* @__PURE__ */ e.jsx("p", { className: "text-gray-900 font-medium break-all", children: r })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col gap-3", children: [
        /* @__PURE__ */ e.jsx(
          "button",
          {
            onClick: t,
            className: "w-full bg-blue-500 hover:bg-blue-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors",
            children: "Continue"
          }
        ),
        /* @__PURE__ */ e.jsx(
          "button",
          {
            onClick: a,
            className: "w-full bg-white hover:bg-gray-50 cursor-pointer text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors border border-gray-200",
            children: "Disconnect"
          }
        )
      ] })
    ] }) : /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: l,
        className: "w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors",
        children: /* @__PURE__ */ e.jsx("span", { children: "MetaMask" })
      }
    )
  ] });
};
export {
  b as ConnectWallet,
  b as default
};

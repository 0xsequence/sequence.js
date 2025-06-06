import { j as e } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
const o = ({ txHash: r, onSendAnother: t, onClose: s }) => /* @__PURE__ */ e.jsxs("div", { className: "space-y-6", children: [
  /* @__PURE__ */ e.jsxs("div", { className: "text-center", children: [
    /* @__PURE__ */ e.jsx("div", { className: "mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100", children: /* @__PURE__ */ e.jsx("svg", { className: "h-6 w-6 text-green-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ e.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }),
    /* @__PURE__ */ e.jsx("h2", { className: "mt-4 text-2xl font-bold text-gray-900", children: "Transaction Confirmed" })
  ] }),
  /* @__PURE__ */ e.jsx("div", { className: "text-center", children: /* @__PURE__ */ e.jsx(
    "a",
    {
      href: `https://example.com/tx/${r}`,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-blue-500 hover:text-blue-600 underline",
      children: "View on Explorer"
    }
  ) }),
  /* @__PURE__ */ e.jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: t,
        className: "w-full bg-blue-500 hover:bg-blue-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors",
        children: "Start Another Transaction"
      }
    ),
    /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: s,
        className: "w-full bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-600 hover:text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors",
        children: "Close"
      }
    )
  ] })
] });
export {
  o as Receipt,
  o as default
};

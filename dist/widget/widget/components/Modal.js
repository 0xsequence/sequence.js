import { j as e } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import l from "../../node_modules/.pnpm/lucide-react@0.493.0_react@19.1.0/node_modules/lucide-react/dist/esm/icons/x.js";
const o = ({ isOpen: s, onClose: t, children: a }) => s ? /* @__PURE__ */ e.jsx("div", { className: "fixed inset-0 z-50 overflow-y-auto", children: /* @__PURE__ */ e.jsxs("div", { className: "flex min-h-full items-center justify-center p-4 text-center", children: [
  /* @__PURE__ */ e.jsx("div", { className: "fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity", onClick: t }),
  /* @__PURE__ */ e.jsxs("div", { className: "relative w-full max-w-md max-h-[90vh] transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all", children: [
    /* @__PURE__ */ e.jsx(
      "button",
      {
        onClick: t,
        className: "absolute right-4 top-4 text-gray-400 hover:text-gray-500 cursor-pointer focus:outline-none",
        children: /* @__PURE__ */ e.jsx(l, { className: "h-5 w-5" })
      }
    ),
    /* @__PURE__ */ e.jsx("div", { className: "max-h-[calc(90vh-4rem)] overflow-y-auto", children: a })
  ] })
] }) }) : null;
export {
  o as Modal,
  o as default
};

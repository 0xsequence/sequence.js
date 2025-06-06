import { j as e } from "../../node_modules/.pnpm/react@19.1.0/node_modules/react/jsx-runtime.js";
import { useEffect as s } from "react";
const i = ({ onComplete: r }) => (s(() => {
  const t = setTimeout(() => {
    r();
  }, 5e3);
  return () => clearTimeout(t);
}, [r]), /* @__PURE__ */ e.jsxs("div", { className: "space-y-6 flex flex-col items-center justify-center py-8", children: [
  /* @__PURE__ */ e.jsx("div", { className: "animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500" }),
  /* @__PURE__ */ e.jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Transfer Pending" }),
  /* @__PURE__ */ e.jsx("p", { className: "text-gray-500", children: "Waiting for confirmation..." })
] }));
export {
  i as TransferPending,
  i as default
};

import { Relayer as l } from "@0xsequence/wallet-core";
import { useMemo as n } from "react";
import * as u from "./node_modules/.pnpm/viem@2.30.6_bufferutil@4.0.9_typescript@5.8.3_utf-8-validate@5.0.10_zod@3.25.51/node_modules/viem/_esm/chains/index.js";
import o from "./node_modules/.pnpm/isomorphic-fetch@3.0.0/node_modules/isomorphic-fetch/fetch-npm-browserify.js";
function a(t) {
  const e = Object.values(u).find((r) => r.id === t);
  if (!e)
    throw new Error(`Chain with id ${t} not found`);
  return e;
}
function y(t) {
  if (t === 42161)
    return new l.Rpc.RpcRelayer("https://a1b4a8c5d856.ngrok.app/", t, "https://nodes.sequence.app/arbitrum");
  if (t === 8453)
    return new l.Rpc.RpcRelayer("https://644a6aeb891e.ngrok.app/", t, "https://nodes.sequence.app/base");
}
function f(t, e) {
  let r;
  if (t.env === "local")
    return e === 42161 ? r = "http://0.0.0.0:9997" : e === 10 ? r = "http://0.0.0.0:9998" : e === 137 ? r = "http://0.0.0.0:9999" : e === 8453 ? r = "http://0.0.0.0:9996" : r = "http://0.0.0.0:9999", r;
  const p = t.env === "cors-anywhere" ? "http://localhost:8080/https://" : t.env === "dev" && t.useV3Relayers ? "https://v3-" : t.env === "dev" ? "https://dev-relayer.sequence.app" : "https://";
  return t.env === "dev" && t.useV3Relayers ? (e === 42161 ? r = "https://v3-arbitrum-relayer.sequence.app" : e === 8453 ? r = "https://v3-base-relayer.sequence.app" : e === 10 ? r = "https://v3-optimism-relayer.sequence.app" : e === 137 ? r = "https://v3-polygon-relayer.sequence.app" : e === 1 ? r = "https://v3-mainnet-relayer.sequence.app" : r = `${p}${a(e).name}-relayer.sequence.app`, r) : (e === 42161 ? r = `${p}arbitrum-relayer.sequence.app` : e === 10 ? r = `${p}optimism-relayer.sequence.app` : e === 137 ? r = `${p}polygon-relayer.sequence.app` : e === 8453 ? r = `${p}base-relayer.sequence.app` : e === 43114 ? r = `${p}avalanche-relayer.sequence.app` : e === 56 ? r = `${p}bsc-relayer.sequence.app` : e === 1 ? r = `${p}mainnet-relayer.sequence.app` : r = `${p}relayer.sequence.app`, r);
}
function i(t, e) {
  const r = a(e);
  if (!r)
    throw new Error(`Chain with id ${e} not found`);
  const p = r.rpcUrls.default.http[0];
  if (!p)
    throw new Error(`No RPC URL found for chain ${e}`);
  const s = f(t, e);
  return new l.Rpc.RpcRelayer(s, e, p, o);
}
function v(t) {
  const e = n(() => /* @__PURE__ */ new Map(), []);
  return {
    relayers: e,
    getRelayer: (p) => {
      let s = e.get(p);
      return s || (s = i(t, p), e.set(p, s)), s;
    },
    getBackupRelayer: y
  };
}
export {
  y as getBackupRelayer,
  i as getRelayer,
  v as useRelayers
};

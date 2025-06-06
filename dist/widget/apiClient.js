import { SequenceAPIClient as s } from "@0xsequence/api";
import { useMemo as l } from "react";
import "./node_modules/.pnpm/@0xsequence_hooks@5.3.4_@0xsequence_api@0.0.0-anypay-20250527101311_@0xsequence_indexer_6fbf5f279950ca81bf6956be6ad27908/node_modules/@0xsequence/hooks/dist/esm/contexts/ConfigContext.js";
import { useConfig as m } from "./node_modules/.pnpm/@0xsequence_hooks@5.3.4_@0xsequence_api@0.0.0-anypay-20250527101311_@0xsequence_indexer_6fbf5f279950ca81bf6956be6ad27908/node_modules/@0xsequence/hooks/dist/esm/hooks/useConfig.js";
import "./node_modules/.pnpm/@0xsequence_network@2.3.17_ethers@6.13.5_bufferutil@4.0.9_utf-8-validate@5.0.10_/node_modules/@0xsequence/network/dist/0xsequence-network.esm.js";
import "viem";
function j(e) {
  return new s(e.apiUrl, e.projectAccessKey, e.jwt);
}
const K = (e) => {
  const { projectAccessKey: t, jwt: r, env: p } = m();
  return l(() => j({
    apiUrl: (e == null ? void 0 : e.apiUrl) ?? p.apiUrl,
    projectAccessKey: (e == null ? void 0 : e.projectAccessKey) ?? t,
    jwt: (e == null ? void 0 : e.jwt) ?? r
  }), [t, r, p.apiUrl, e]);
};
export {
  j as getAPIClient,
  K as useAPIClient
};

import { SequenceIndexerGateway as w } from "./node_modules/.pnpm/@0xsequence_indexer@2.3.17/node_modules/@0xsequence/indexer/dist/0xsequence-indexer.esm.js";
import { useMemo as s } from "react";
import "./node_modules/.pnpm/@0xsequence_hooks@5.3.4_@0xsequence_api@0.0.0-anypay-20250527101311_@0xsequence_indexer_6fbf5f279950ca81bf6956be6ad27908/node_modules/@0xsequence/hooks/dist/esm/contexts/ConfigContext.js";
import { useConfig as y } from "./node_modules/.pnpm/@0xsequence_hooks@5.3.4_@0xsequence_api@0.0.0-anypay-20250527101311_@0xsequence_indexer_6fbf5f279950ca81bf6956be6ad27908/node_modules/@0xsequence/hooks/dist/esm/hooks/useConfig.js";
import "@0xsequence/api";
import "./node_modules/.pnpm/@0xsequence_network@2.3.17_ethers@6.13.5_bufferutil@4.0.9_utf-8-validate@5.0.10_/node_modules/@0xsequence/network/dist/0xsequence-network.esm.js";
import "viem";
function p(e) {
  return new w(e.indexerGatewayUrl, e.projectAccessKey, e.jwt);
}
const C = (e) => {
  const { projectAccessKey: t, jwt: r, env: a } = y();
  return s(() => p({
    indexerGatewayUrl: (e == null ? void 0 : e.indexerGatewayUrl) ?? a.indexerGatewayUrl,
    projectAccessKey: (e == null ? void 0 : e.projectAccessKey) ?? t,
    jwt: (e == null ? void 0 : e.jwt) ?? r
  }), [t, r, a.indexerGatewayUrl, e]);
};
export {
  p as getIndexerGatewayClient,
  C as useIndexerGatewayClient
};

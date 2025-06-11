import { Payload as m, Config as b } from "@0xsequence/wallet-primitives";
import { ANYPAY_LIFI_SAPIENT_SIGNER_LITE_ADDRESS as A } from "./constants.js";
import { isAddressEqual as T } from "viem";
import { findPreconditionAddress as E } from "./preconditions.js";
import { toHex as g, from as u, concat as p, fromHex as C, padLeft as B } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/Bytes.js";
import { from as l } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/Address.js";
import { keccak256 as f } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/Hash.js";
import { encode as I } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/AbiParameters.js";
import { fromCreate2 as k } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/ContractAddress.js";
async function z(n, t) {
  return n.getIntentCallsPayloads(t);
}
function x(n, t, e) {
  console.log("calculateIntentAddress inputs:", {
    mainSigner: n,
    calls: JSON.stringify(t, null, 2),
    lifiInfosArg: JSON.stringify(e, null, 2)
  });
  const s = {
    factory: "0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447",
    stage1: "0x53bA242E7C2501839DF2972c75075dc693176Cd0",
    creationCode: "0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3"
  }, d = t.map((i) => ({
    type: "call",
    chainId: BigInt(i.chainId),
    space: i.space ? BigInt(i.space) : 0n,
    nonce: i.nonce ? BigInt(i.nonce) : 0n,
    calls: i.calls.map((o) => ({
      to: l(o.to),
      value: BigInt(o.value || "0"),
      data: g(u(o.data || "0x")),
      gasLimit: BigInt(o.gasLimit || "0"),
      delegateCall: !!o.delegateCall,
      onlyFallback: !!o.onlyFallback,
      behaviorOnError: Number(o.behaviorOnError) === 0 ? "ignore" : Number(o.behaviorOnError) === 1 ? "revert" : "abort"
    }))
  })), c = e == null ? void 0 : e.map((i) => ({
    originToken: l(i.originToken),
    amount: BigInt(i.amount),
    originChainId: BigInt(i.originChainId),
    destinationChainId: BigInt(i.destinationChainId)
  }));
  console.log(
    "Transformed coreLifiInfos:",
    JSON.stringify(c, (i, o) => typeof o == "bigint" ? o.toString() : o, 2)
  );
  const r = S(
    l(n),
    d,
    s,
    // AnyPay.ANYPAY_LIFI_ATTESATION_SIGNER_ADDRESS,
    l("0x0000000000000000000000000000000000000001"),
    c
  );
  return console.log("Final calculated address:", r.toString()), r;
}
function M(n, t, e, s, d) {
  console.log("commitIntentConfig inputs:", {
    mainSigner: t,
    calls: JSON.stringify(e, null, 2),
    preconditions: JSON.stringify(s, null, 2),
    lifiInfos: JSON.stringify(d, null, 2)
  });
  const c = x(t, e, d), r = E(s);
  console.log("Address comparison:", {
    receivedAddress: r,
    calculatedAddress: c.toString(),
    match: T(l(r), c)
  });
  const i = {
    walletAddress: c.toString(),
    mainSigner: t,
    calls: e,
    preconditions: s,
    lifiInfos: d
  };
  return console.log("args", i), n.commitIntentConfig(i);
}
async function U(n, t, e) {
  return await t.sendTransaction({
    account: n,
    to: e.to,
    data: e.data,
    value: BigInt(e.value),
    chain: e.chain
  });
}
function Y(n) {
  if (!n) throw new Error("params is nil");
  if (!n.userAddress || n.userAddress === "0x0000000000000000000000000000000000000000")
    throw new Error("UserAddress is zero");
  if (typeof n.nonce != "bigint") throw new Error("Nonce is not a bigint");
  if (!n.originTokens || n.originTokens.length === 0) throw new Error("OriginTokens is empty");
  if (!n.destinationCalls || n.destinationCalls.length === 0) throw new Error("DestinationCalls is empty");
  if (!n.destinationTokens || n.destinationTokens.length === 0) throw new Error("DestinationTokens is empty");
  for (let a = 0; a < n.destinationCalls.length; a++) {
    const h = n.destinationCalls[a];
    if (!h) throw new Error(`DestinationCalls[${a}] is nil`);
    if (!h.calls || h.calls.length === 0)
      throw new Error(`DestinationCalls[${a}] has no calls`);
  }
  const t = n.originTokens.map((a) => ({
    address: a.address,
    chainId: a.chainId
  }));
  let e = u(new Uint8Array(32));
  for (let a = 0; a < n.destinationCalls.length; a++) {
    const h = n.destinationCalls[a], w = m.hash(
      l("0x0000000000000000000000000000000000000000"),
      h.chainId,
      h
    );
    e = f(p(e, w), {
      as: "Bytes"
    });
  }
  const s = g(e), d = n.destinationTokens.map((a) => ({
    address: a.address,
    chainId: a.chainId,
    amount: a.amount
  })), r = I([
    { type: "address" },
    { type: "uint256" },
    {
      type: "tuple[]",
      components: [
        { name: "address", type: "address" },
        { name: "chainId", type: "uint256" }
      ]
    },
    {
      type: "tuple[]",
      components: [
        { name: "address", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "amount", type: "uint256" }
      ]
    },
    { type: "bytes32" }
  ], [
    n.userAddress,
    n.nonce,
    t,
    d,
    s
  ]), i = C(r), o = f(i);
  return g(o);
}
function q(n, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function L(n, t) {
  if (!n || n.length === 0)
    throw new Error("lifiInfos is empty");
  if (!t || t === "0x0000000000000000000000000000000000000000")
    throw new Error("attestationAddress is zero");
  const e = [
    { name: "originToken", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "originChainId", type: "uint256" },
    { name: "destinationChainId", type: "uint256" }
  ], s = n.map((o) => ({
    originToken: o.originToken,
    amount: o.amount,
    originChainId: o.originChainId,
    destinationChainId: o.destinationChainId
  })), c = I([
    {
      type: "tuple[]",
      name: "lifiInfos",
      components: e
    },
    { type: "address", name: "attestationAddress" }
  ], [s, t]), r = C(c), i = f(r);
  return g(i);
}
function S(n, t, e, s, d) {
  const c = H(n, t, s, d), r = b.hashConfiguration(c);
  return k({
    from: e.factory,
    bytecodeHash: f(
      p(u(e.creationCode), B(u(e.stage1), 32)),
      { as: "Bytes" }
    ),
    salt: r
  });
}
function H(n, t, e, s) {
  const d = {
    type: "signer",
    address: n,
    weight: 1n
  }, r = [...t.map((o) => {
    const y = m.hash(l("0x0000000000000000000000000000000000000000"), o.chainId, o);
    return console.log("digest:", g(y)), {
      type: "any-address-subdigest",
      digest: g(y)
    };
  })];
  if (s && s.length > 0 && e) {
    const o = {
      type: "sapient-signer",
      // address: ANYPAY_LIFI_SAPIENT_SIGNER_ADDRESS,
      address: A,
      weight: 1n,
      imageHash: L(s, e)
    };
    r.push(o);
  }
  if (r.length === 0)
    throw new Error("Intent configuration must have at least one call or LiFi information.");
  let i;
  return r.length === 1 ? i = r[0] : i = v(r), {
    threshold: 1n,
    checkpoint: 0n,
    topology: [d, i]
  };
}
function v(n) {
  if (n.length === 0)
    throw new Error("Cannot create a tree from empty members");
  if (n.length === 1)
    return n[0];
  let t = [...n];
  for (; t.length > 1; ) {
    const e = [];
    for (let s = 0; s < t.length; s += 2) {
      const d = t[s];
      if (s + 1 < t.length) {
        const c = t[s + 1];
        e.push([d, c]);
      } else
        e.push(d);
    }
    t = e;
  }
  return t[0];
}
export {
  q as bigintReplacer,
  x as calculateIntentAddress,
  S as calculateIntentConfigurationAddress,
  M as commitIntentConfig,
  L as getAnypayLifiInfoHash,
  z as getIntentCallsPayloads,
  Y as hashIntentParams,
  U as sendOriginTransaction
};

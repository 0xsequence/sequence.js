async function r(t, n, a) {
  const { opHash: e } = await t.sendMetaTxn(
    n.walletAddress,
    n.contract,
    n.input,
    BigInt(n.chainId),
    void 0,
    a
  );
  return e;
}
export {
  r as relayerSendMetaTx
};

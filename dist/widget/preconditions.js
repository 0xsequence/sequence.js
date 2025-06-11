function t(o) {
  console.log("Finding precondition address from:", JSON.stringify(o, null, 2));
  const d = ["erc20-balance", "native-balance"];
  for (const s of d) {
    const n = o.find((i) => {
      var r;
      return i.type === s && ((r = i.data) == null ? void 0 : r.address);
    });
    if (n)
      return console.log(`Found ${s} precondition with address:`, n.data.address), n.data.address;
  }
  const e = `N/A (No ${d.join(" or ")} precondition with address found)`;
  return console.log(e), e;
}
export {
  t as findPreconditionAddress
};

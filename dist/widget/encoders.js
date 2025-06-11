import { from as e, encodeData as o } from "./node_modules/.pnpm/ox@0.7.2_typescript@5.8.3_zod@3.25.51/node_modules/ox/_esm/core/AbiFunction.js";
function f(r, n) {
  const t = e("function transfer(address,uint256) returns (bool)");
  return o(t, [r, n]);
}
export {
  f as getERC20TransferData
};

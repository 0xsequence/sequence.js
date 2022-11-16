import { BigNumber, BigNumberish, utils } from 'ethers'

// ethers implement this method but doesn't exports it
export function isBigNumberish(value: any): value is BigNumberish {
  return (value != null) && (
      BigNumber.isBigNumber(value) ||
      (typeof(value) === "number" && (value % 1) === 0) ||
      (typeof(value) === "string" && !!value.match(/^-?[0-9]+$/)) ||
      utils.isHexString(value) ||
      (typeof(value) === "bigint") ||
      utils.isBytes(value)
  )
}

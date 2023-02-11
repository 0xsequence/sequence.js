import { BigNumberish, isHexString, isBytesLike } from 'ethers'

// ethers implement this method but doesn't exports it
export function isBigNumberish(value: any): value is BigNumberish {
  return (
    value != null &&
    (typeof value === 'bigint' ||
      (typeof value === 'number' && value % 1 === 0) ||
      (typeof value === 'string' && !!value.match(/^-?[0-9]+$/)) ||
      isHexString(value) ||
      isBytesLike(value))
  )
}

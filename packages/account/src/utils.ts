import { ethers } from "ethers"
import { isPromise } from "util/types"

export function isDeferrable<T>(value: any): value is ethers.utils.Deferrable<T> {
  // The value is deferrable if any of the properties is a Promises
  if (typeof(value) === "object") {
    return Object.keys(value).some((key) => isPromise(value[key]))
  }

  return false
}

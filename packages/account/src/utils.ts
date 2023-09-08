import { ethers } from 'ethers'

function isPromise(value: any): value is Promise<any> {
  return !!value && typeof value.then === 'function'
}

export function isDeferrable<T>(value: any): value is ethers.utils.Deferrable<T> {
  // The value is deferrable if any of the properties is a Promises
  if (typeof value === 'object') {
    return Object.keys(value).some(key => isPromise(value[key]))
  }

  return false
}

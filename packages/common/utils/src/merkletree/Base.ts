import { ethers } from 'ethers'

export class Base {
  static bufferIndexOf(array: Uint8Array[], element: Uint8Array, isSorted: boolean = false): number {
    if (isSorted) {
      return Base.binarySearch(array, element, Base.compare)
    }

    const eqChecker = (buffer1: Uint8Array, buffer2: Uint8Array): boolean => {
      if (buffer1 === buffer2) {
        return true
      }
      if (buffer1.length !== buffer2.length) {
        return false
      }
      for (let i = 0; i < buffer1.length; i++) {
        if (buffer1[i] !== buffer2[i]) {
          return false
        }
      }
      return true
    }

    return Base.linearSearch(array, element, eqChecker)
  }

  static binarySearch(
    array: Uint8Array[],
    element: Uint8Array,
    compareFunction: (a: Uint8Array, b: Uint8Array) => number
  ): number {
    let start = 0
    let end = array.length - 1

    // Iterate while start not meets end
    while (start <= end) {
      // Find the mid index
      const mid = Math.floor((start + end) / 2)

      // Check if the mid value is greater than, equal to, or less than search element.
      const ordering = compareFunction(array[mid], element)

      // If element is present at mid, start iterating for searching first appearance.
      if (ordering === 0) {
        // Linear reverse iteration until the first matching item index is found.
        for (let i = mid - 1; i >= 0; i--) {
          if (compareFunction(array[i], element) === 0) continue
          return i + 1
        }
        return 0
      } /* Else look in left or right half accordingly */ else if (ordering < 0) {
        start = mid + 1
      } else {
        end = mid - 1
      }
    }

    return -1
  }

  static compare(a: Uint8Array, b: Uint8Array): number {
    // Determine the minimum length to compare
    const len = Math.min(a.length, b.length)

    // Compare byte by byte
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i]
      }
    }

    // If all compared bytes are equal, compare lengths
    return a.length - b.length
  }

  static linearSearch(array: Uint8Array[], element: Uint8Array, eqChecker: (a: Uint8Array, b: Uint8Array) => boolean): number {
    for (let i = 0; i < array.length; i++) {
      if (eqChecker(array[i], element)) {
        return i
      }
    }

    return -1
  }

  static bufferify(value: Uint8Array | string): Uint8Array {
    if (typeof value === 'string') {
      return ethers.getBytes(value)
    }
    return value
  }

  static isHexString(v: string): boolean {
    return typeof v === 'string' && /^(0x)?[0-9A-Fa-f]*$/.test(v)
  }

  static bufferToHex(value: Uint8Array, withPrefix: boolean = true): string {
    const prefixed = ethers.hexlify(value)
    return withPrefix ? prefixed : prefixed.substring(2)
  }

  static bufferifyFn(f: any): any {
    return (value: any): Uint8Array => {
      return Base.bufferify(f(value))
    }
  }
}

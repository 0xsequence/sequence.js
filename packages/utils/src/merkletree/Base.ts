import { Buffer } from 'buffer'

export class Base {
  protected bufferIndexOf(array: Buffer[], element: Buffer, isSorted: boolean = false): number {
    if (isSorted) {
      return this.binarySearch(array, element, Buffer.compare)
    }

    const eqChecker = (buffer1: Buffer, buffer2: Buffer) => buffer1.equals(buffer2)
    return this.linearSearch(array, element, eqChecker)
  }

  static binarySearch(array: Buffer[], element: Buffer, compareFunction: (a: unknown, b: unknown) => number): number {
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

  binarySearch(array: Buffer[], element: Buffer, compareFunction: (a: unknown, b: unknown) => number): number {
    return Base.binarySearch(array, element, compareFunction)
  }

  static linearSearch(array: Buffer[], element: Buffer, eqChecker: (a: unknown, b: unknown) => boolean): number {
    for (let i = 0; i < array.length; i++) {
      if (eqChecker(array[i], element)) {
        return i
      }
    }

    return -1
  }

  linearSearch(array: Buffer[], element: Buffer, eqChecker: (a: unknown, b: unknown) => boolean): number {
    return Base.linearSearch(array, element, eqChecker)
  }

  static bufferify(value: any): Buffer {
    if (!Buffer.isBuffer(value)) {
      if (Base.isHexString(value)) {
        return Buffer.from(value.replace(/^0x/, ''), 'hex')
      } else if (typeof value === 'string') {
        return Buffer.from(value)
      } else if (typeof value === 'bigint') {
        return Buffer.from(value.toString(16), 'hex')
      } else if (typeof value === 'number') {
        let s = value.toString()
        if (s.length % 2) {
          s = `0${s}`
        }
        return Buffer.from(s, 'hex')
      } else if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      }
    }

    return value
  }

  bigNumberify(value: any): BigInt {
    return Base.bigNumberify(value)
  }

  static bigNumberify(value: any): BigInt {
    if (typeof value === 'bigint') {
      return value
    }

    if (typeof value === 'string') {
      if (value.startsWith('0x') && Base.isHexString(value)) {
        return BigInt('0x' + value.replace('0x', '').toString())
      }
      return BigInt(value)
    }

    if (Buffer.isBuffer(value)) {
      return BigInt('0x' + value.toString('hex'))
    }

    if (typeof value === 'number') {
      return BigInt(value)
    }

    throw new Error('cannot bigNumberify')
  }

  static isHexString(v: string): boolean {
    return typeof v === 'string' && /^(0x)?[0-9A-Fa-f]*$/.test(v)
  }

  static print(tree: any): void {
    console.log(tree.toString())
  }

  bufferToHex(value: Buffer, withPrefix: boolean = true): string {
    return Base.bufferToHex(value, withPrefix)
  }

  static bufferToHex(value: Buffer, withPrefix: boolean = true): string {
    return `${withPrefix ? '0x' : ''}${(value || Buffer.alloc(0)).toString('hex')}`
  }

  bufferify(value: any): Buffer {
    return Base.bufferify(value)
  }

  bufferifyFn(f: any): any {
    return (value: any): Buffer => {
      const v = f(value)
      if (Buffer.isBuffer(v)) {
        return v
      }

      if (this.isHexString(v)) {
        return Buffer.from(v.replace('0x', ''), 'hex')
      }

      if (typeof v === 'string') {
        return Buffer.from(v)
      }

      if (typeof v === 'bigint') {
        return Buffer.from(value.toString(16), 'hex')
      }

      if (ArrayBuffer.isView(v)) {
        return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
      }

      return Buffer.from(value.toString('hex'), 'hex')
    }
  }

  protected isHexString(value: string): boolean {
    return Base.isHexString(value)
  }
}

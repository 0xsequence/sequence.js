import { ethers } from 'ethers'

export const MAX_UINT_256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

// ethers implement this method but doesn't exports it
export const isBigNumberish = (value: any): value is ethers.BigNumberish => {
  return (
    value != null &&
    ((typeof value === 'number' && value % 1 === 0) ||
      (typeof value === 'string' && !!value.match(/^-?[0-9]+$/)) ||
      ethers.isHexString(value) ||
      typeof value === 'bigint')
  )
}

// Even length zero-padded hex string with 0x prefix
export const toHexString = (value: bigint): string => {
  const result = value.toString(16)

  return `${result.length % 2 === 0 ? '0x' : '0x0'}${result}`
}

export const parseUnits = (value: string, decimals: number = 18): bigint => {
  let [integer, fraction = '0'] = value.split('.')

  const negative = integer.startsWith('-')
  if (negative) {
    integer = integer.slice(1)
  }

  // trim trailing zeros.
  fraction = fraction.replace(/(0+)$/, '')

  // round off if the fraction is larger than the number of decimals.
  if (decimals === 0) {
    integer = `${Math.round(Number(`${integer}.${fraction}`))}`
    fraction = ''
  } else if (fraction.length > decimals) {
    const [left, unit, right] = [
      fraction.slice(0, decimals - 1),
      fraction.slice(decimals - 1, decimals),
      fraction.slice(decimals)
    ]

    const rounded = Math.round(Number(`${unit}.${right}`))
    if (rounded > 9) {
      fraction = `${BigInt(left) + 1n}0`.padStart(left.length + 1, '0')
    } else {
      fraction = `${left}${rounded}`
    }

    if (fraction.length > decimals) {
      fraction = fraction.slice(1)
      integer = `${BigInt(integer) + 1n}`
    }

    fraction = fraction.slice(0, decimals)
  } else {
    fraction = fraction.padEnd(decimals, '0')
  }

  return BigInt(`${negative ? '-' : ''}${integer}${fraction}`)
}

export const parseEther = (value: string): bigint => parseUnits(value, 18)

export const formatUnits = (value: bigint, decimals: number = 18): string => {
  let display = value.toString()

  const negative = display.startsWith('-')
  if (negative) {
    display = display.slice(1)
  }

  display = display.padStart(decimals, '0')

  const integer = display.slice(0, display.length - decimals)
  let fraction = display.slice(display.length - decimals)

  fraction = fraction.replace(/(0+)$/, '')
  return `${negative ? '-' : ''}${integer || '0'}${fraction ? `.${fraction}` : ''}`
}

export const formatEther = (value: bigint): string => formatUnits(value, 18)

// JSON.stringify doesn't handle BigInts, so we need to replace them with objects
export const bigintReplacer = (key: string, value: any): any => {
  if (typeof value === 'bigint') {
    return { $bigint: value.toString() }
  }

  return value
}

// JSON.parse will need to convert our serialized bigints back into BigInt
export const bigintReviver = (key: string, value: any): any => {
  if (value !== null && typeof value === 'object' && '$bigint' in value && typeof value.$bigint === 'string') {
    return BigInt(value.$bigint)
  }

  // BigNumber compatibility with older versions of sequence.js with ethers v5
  if (value !== null && typeof value === 'object' && value.type === 'BigNumber' && ethers.isHexString(value.hex)) {
    return BigInt(value.hex)
  }

  return value
}

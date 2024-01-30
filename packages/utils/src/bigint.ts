export const MAX_UINT_256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

// Even length zero-padded hex string with 0x prefix
export const toHexString = (value: bigint): string => {
  let result = value.toString(16)
  const desiredLength = 2 * Math.round(result.length / 2)

  result = result.padStart(desiredLength, '0')

  return '0x' + result
}

export const parseUnits = (value: string, decimals: number = 18): bigint => {
  let [integer, fraction = '0'] = value.split('.')

  const negative = integer.startsWith('-')
  if (negative) {
    integer = integer.slice(1)
  }

  // trim leading zeros.
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
      fraction = `${BigInt(left) + BigInt(1)}0`.padStart(left.length + 1, '0')
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

// from viem
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

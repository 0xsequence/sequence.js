// Even length zero-padded hex string with 0x prefix
export const toHexString = (value: bigint): string => {
  let result = value.toString(16)
  const desiredLength = 2 * Math.round(result.length / 2)

  result = result.padStart(desiredLength, '0')

  return '0x' + result
}

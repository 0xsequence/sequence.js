
// sanitizeNumberString accepts a number string and returns back a clean number string.
// For example, input '1234.5678' will return '1234.5678' but '12javascript:{}etc' will return '12'
export const sanitizeNumberString = (numString: string): string => {
  if (!numString || typeof(numString) !== 'string') {
    return ''
  }
  const v = numString.match(/[\d.]+/)
  return v && v.length > 0 ? v[0] : ''
}

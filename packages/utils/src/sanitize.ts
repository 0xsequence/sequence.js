
// sanitizeNumberString accepts a number string and returns back a clean number string.
// For example, input '1234.5678' will return '1234.5678' but '12javascript:{}etc' will return '12'
export const sanitizeNumberString = (numString: string | null): string => {
  if (!numString || typeof(numString) !== 'string') {
    return ''
  }
  const v = numString.match(/[\d.]+/)
  return v && v.length > 0 ? v[0].trim() : ''
}

// sanitizeAlphanumeric accepts any string and returns alphanumeric contents only
export const sanitizeAlphanumeric = (alphanum: string): string => {
  if (!alphanum || typeof(alphanum) !== 'string') {
    return ''
  }
  const v = alphanum.match(/[\w\s\d]+/)
  return v && v.length > 0 ? v[0].trim() : ''
}

// sanitizeHost accepts any string and returns valid host string
export const sanitizeHost = (host: string): string => {
  if (!host || typeof(host) !== 'string') {
    return ''
  }
  const v = host.match(/[\w\d.\-:\/]+/)
  return v && v.length > 0 ? v[0].trim() : ''
}

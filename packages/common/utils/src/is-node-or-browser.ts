export const isNode = () => {
  if (typeof window === 'undefined' && typeof process === 'object') {
    return true
  } else {
    return false
  }
}

export const isBrowser = () => !isNode()

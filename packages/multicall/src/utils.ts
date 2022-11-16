import { BigNumber, BigNumberish } from 'ethers'

export async function safeSolve<T>(promise: Promise<T>, def: T | ((e: any) => T)): Promise<T> {
  try {
    return await promise
  } catch (e) {
    const d = def instanceof Function ? def(e) : def
    return d
  }
}

export function partition<T>(array: T[], callback: (v: T, i: number) => boolean): [T[], T[]] {
  return array.reduce(function(result, element, i) {
      callback(element, i) ? result[0].push(element) : result[1].push(element)
      return result
    }, [[] as any[], [] as any[]]
  )
}

export type BlockTag = 'earliest' | 'latest' | 'pending' | BigNumber

export function parseBlockTag(cand: string | BigNumberish | undefined): BlockTag {
  if (cand === undefined) return 'latest'

  switch (cand) {
    case 'earliest':
    case 'latest':
    case 'pending':
      return cand
  }

  return BigNumber.from(cand)
}

export function eqBlockTag(a: BlockTag, b: BlockTag): boolean {
  if (a === b) return true

  if (BigNumber.isBigNumber(a)) {
    if (BigNumber.isBigNumber(b)) return a.eq(b)
    return false
  }

  if (BigNumber.isBigNumber(b)) return false
  return a === b
}

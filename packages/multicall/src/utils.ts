import { BigIntish } from '@0xsequence/utils'

export async function safeSolve<T>(promise: Promise<T>, def: T | ((e: any) => T)): Promise<T> {
  try {
    return await promise
  } catch (e) {
    const d = def instanceof Function ? def(e) : def
    return d
  }
}

export function partition<T>(array: T[], callback: (v: T, i: number) => boolean): [T[], T[]] {
  return array.reduce(
    function (result, element, i) {
      callback(element, i) ? result[0].push(element) : result[1].push(element)
      return result
    },
    [[] as any[], [] as any[]]
  )
}

export type BlockTag = 'earliest' | 'latest' | 'pending' | bigint

export function parseBlockTag(cand: string | BigIntish | undefined): BlockTag {
  if (cand === undefined) return 'latest'

  switch (cand) {
    case 'earliest':
    case 'latest':
    case 'pending':
      return cand
  }

  return BigInt(cand)
}

export function eqBlockTag(a: BlockTag, b: BlockTag): boolean {
  return a === b
}

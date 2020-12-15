import { ethers, BigNumber, BigNumberish } from "ethers"

export function promisify<T>(f: (cb: (err: any, res: T) => void) => void, thisContext?: any): () => Promise<T>
export function promisify<A, T>(f: (arg: A, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A) => Promise<T>
export function promisify<A, A2, T>(f: (arg: A, arg2: A2, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A, arg2: A2) => Promise<T>

export function promisify(f: any, thisContext?: any) {
  return function () {
    let args = Array.prototype.slice.call(arguments)
    return new Promise(async (resolve, reject) => {
      try {
        args.push((err: any, result: any) => err ? reject(err) : resolve(result))
        await f.apply(thisContext, args)
      } catch (e) {
        reject(e)
      }
    })
  }
}

export async function safeSolve<T>(promise: Promise<T>, def: T | ((e: any) => T)): Promise<T> {
  try {
    return await promise
  } catch (e) {
    const d = def instanceof Function ? def(e) : def
    return d
  }
}

export function safe<T extends (...p: any[]) => any>(method: T, def?: ReturnType<T>, thisContext?: any): (...params: Parameters<T>) => ReturnType<T> {
  return function() {
    let args = Array.prototype.slice.call(arguments)
    try {
      return method.apply(thisContext, ...args)
    } catch (e) {
      return def
    }
  }
}

export function getRandomInt(min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function partition<T>(array: T[], callback: (v: T, i: number) => boolean): [T[], T[]] {
  return array.reduce(function(result, element, i) {
      callback(element, i) ? result[0].push(element) : result[1].push(element)
      return result
    }, [[], []]
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

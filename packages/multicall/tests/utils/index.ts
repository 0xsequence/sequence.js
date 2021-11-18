import { ethers } from 'ethers'

export type SpyProxyHooks<K, T extends (...args: any[]) => any> = {
  prop: keyof K
  func: T
  callback: (...params: Parameters<T>) => boolean | void
}

export const SpyProxy = <T extends Object>(obj: T, ...hooks: SpyProxyHooks<T, (...args: any[]) => any>[]): T => {
  const handler = {
    get: function (target: T, prop: keyof T, receiver: any) {
      if (target[prop] instanceof Function) {
        return (...p: any): any => {
          if (
            !hooks
              .filter(h => h.prop === prop)
              .map(f => f.callback(...p))
              .reduce((p, c) => p || c, false)
          ) {
            return (obj[prop] as unknown as Function)(...p)
          }
        }
      }

      if (Object.getPrototypeOf(obj)[prop] !== null) {
        return obj[prop]
      }

      return Reflect.get(target, prop, receiver)
    }
  }

  // @ts-ignore
  return new Proxy(obj, handler)
}

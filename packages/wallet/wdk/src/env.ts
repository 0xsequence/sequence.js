import type { CoreEnv } from '@0xsequence/wallet-core'
import { resolveCoreEnv } from '@0xsequence/wallet-core'

export type TimersLike = {
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
}

export type LockManagerLike = {
  request: (name: string, callback: (lock: Lock | null) => Promise<void> | void) => Promise<void>
}

export type NavigationLike = {
  getPathname: () => string
  redirect: (url: string) => void
}

export type WdkEnv = CoreEnv & {
  timers?: TimersLike
  locks?: LockManagerLike
  navigation?: NavigationLike
  urlSearchParams?: typeof URLSearchParams
}

export function resolveWdkEnv(env?: WdkEnv): WdkEnv {
  const core = resolveCoreEnv(env)
  const globalObj = globalThis as any
  const windowObj = typeof window !== 'undefined' ? window : (globalObj.window ?? {})
  const location = windowObj.location ?? globalObj.location

  return {
    ...core,
    timers:
      env?.timers ??
      (typeof globalObj.setTimeout === 'function'
        ? {
            setTimeout: globalObj.setTimeout.bind(globalObj),
            clearTimeout: globalObj.clearTimeout.bind(globalObj),
            setInterval: globalObj.setInterval.bind(globalObj),
            clearInterval: globalObj.clearInterval.bind(globalObj),
          }
        : undefined),
    locks: env?.locks ?? globalObj.navigator?.locks ?? windowObj.navigator?.locks,
    navigation:
      env?.navigation ??
      (location
        ? {
            getPathname: () => location.pathname,
            redirect: (url: string) => {
              location.href = url
            },
          }
        : undefined),
    urlSearchParams: env?.urlSearchParams ?? globalObj.URLSearchParams ?? windowObj.URLSearchParams,
  }
}

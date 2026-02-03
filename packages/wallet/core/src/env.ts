export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type CryptoLike = {
  subtle: SubtleCrypto
  getRandomValues: <T extends ArrayBufferView>(array: T) => T
}

export type TextEncodingLike = {
  TextEncoder: typeof TextEncoder
  TextDecoder: typeof TextDecoder
}

export type CoreEnv = {
  fetch?: typeof fetch
  crypto?: CryptoLike
  storage?: StorageLike
  indexedDB?: IDBFactory
  text?: Partial<TextEncodingLike>
}

function isStorageLike(value: unknown): value is StorageLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as StorageLike
  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  )
}

export function resolveCoreEnv(env?: CoreEnv): CoreEnv {
  const globalObj = globalThis as any
  const windowObj = typeof window !== 'undefined' ? window : (globalObj.window ?? {})
  let storage: StorageLike | undefined
  let text: Partial<TextEncodingLike> | undefined

  if (isStorageLike(env?.storage)) {
    storage = env.storage
  } else if (isStorageLike(windowObj.localStorage)) {
    storage = windowObj.localStorage
  } else if (isStorageLike(globalObj.localStorage)) {
    storage = globalObj.localStorage
  }

  if (env?.text) {
    if (!env.text.TextEncoder || !env.text.TextDecoder) {
      throw new Error('env.text must provide both TextEncoder and TextDecoder')
    }
    text = env.text
  } else {
    text = {
      TextEncoder: windowObj.TextEncoder ?? globalObj.TextEncoder,
      TextDecoder: windowObj.TextDecoder ?? globalObj.TextDecoder,
    }
  }

  return {
    fetch: env?.fetch ?? windowObj.fetch ?? globalObj.fetch,
    crypto: env?.crypto ?? windowObj.crypto ?? globalObj.crypto,
    storage,
    indexedDB: env?.indexedDB ?? windowObj.indexedDB ?? globalObj.indexedDB,
    text,
  }
}

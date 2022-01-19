import { WalletConfig } from './config'

const maxCachedConfigs = 10

const listKey = '@sequence.config.imageHashes'
const configKey = (imageHash: string) => `@sequence.config.${imageHash}`

let storage: {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

try {
  storage = localStorage
} catch {
  const map: Map<string, string> = new Map()
  storage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key)
  }
}

export function getCachedConfig(imageHash: string): WalletConfig | undefined {
  const config = JSON.parse(storage.getItem(configKey(imageHash)) ?? 'null')
  if (config) {
    pushImageHash(imageHash)
    return config
  } else {
    return
  }
}

export function cacheConfig(imageHash: string, config: WalletConfig) {
  storage.setItem(configKey(imageHash), JSON.stringify(config))
  pushImageHash(imageHash)
}

function pushImageHash(imageHash: string) {
  let imageHashes: string[] = JSON.parse(storage.getItem(listKey) ?? '[]')
  imageHashes = imageHashes.filter(hash => hash !== imageHash)
  imageHashes.push(imageHash)
  while (imageHashes.length > maxCachedConfigs) {
    storage.removeItem(configKey(imageHashes.shift()!))
  }
  storage.setItem(listKey, JSON.stringify(imageHashes))
}

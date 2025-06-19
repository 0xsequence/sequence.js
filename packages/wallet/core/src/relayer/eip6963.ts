import { createStore, EIP6963ProviderInfo, EIP6963ProviderDetail } from 'mipd'
import { EIP1193ProviderAdapter, LocalRelayer } from './local.js'

export class EIP6963Relayer extends LocalRelayer {
  public readonly info: EIP6963ProviderInfo

  constructor(detail: EIP6963ProviderDetail) {
    super(new EIP1193ProviderAdapter(detail.provider))
    this.info = detail.info
  }
}

// Global store instance
let store: ReturnType<typeof createStore> | undefined

export function getEIP6963Store() {
  if (!store) {
    store = createStore()
  }
  return store
}

let relayers: Map<string, EIP6963Relayer> = new Map()

export function getRelayers(): EIP6963Relayer[] {
  const store = getEIP6963Store()
  const providers = store.getProviders()

  for (const detail of providers) {
    if (!relayers.has(detail.info.uuid)) {
      relayers.set(detail.info.uuid, new EIP6963Relayer(detail))
    }
  }

  return Array.from(relayers.values())
}

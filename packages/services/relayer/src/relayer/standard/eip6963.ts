import { createStore, EIP6963ProviderInfo, EIP6963ProviderDetail } from 'mipd'
import { EIP1193ProviderAdapter, LocalRelayer } from './local.js'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../index.js'
import { Address, Hex } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { FeeToken, TransactionPrecondition } from '../rpc-relayer/relayer.gen.js'

export class EIP6963Relayer implements Relayer {
  public readonly kind: 'relayer' = 'relayer'
  public readonly type = 'eip6963'
  public readonly id: string
  public readonly info: EIP6963ProviderInfo
  private readonly relayer: LocalRelayer

  constructor(detail: EIP6963ProviderDetail) {
    this.info = detail.info
    this.id = detail.info.uuid

    this.relayer = new LocalRelayer(new EIP1193ProviderAdapter(detail.provider))
  }

  isAvailable(wallet: Address.Address, chainId: number): Promise<boolean> {
    return this.relayer.isAvailable(wallet, chainId)
  }

  feeTokens(): Promise<{ isFeeRequired: boolean; tokens?: FeeToken[]; paymentAddress?: Address.Address }> {
    return this.relayer.feeTokens()
  }

  feeOptions(
    wallet: Address.Address,
    chainId: number,
    to: Address.Address,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    return this.relayer.feeOptions(wallet, chainId, to, calls)
  }

  async relay(to: Address.Address, data: Hex.Hex, chainId: number, _?: FeeQuote): Promise<{ opHash: Hex.Hex }> {
    return this.relayer.relay(to, data, chainId)
  }

  status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus> {
    return this.relayer.status(opHash, chainId)
  }

  async checkPrecondition(precondition: TransactionPrecondition): Promise<boolean> {
    return this.relayer.checkPrecondition(precondition)
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

import { Address, Hex } from 'ox'
import { WalletRow } from '../manager'
import { Relayer } from '@0xsequence/sequence-core'
import { Payload } from '@0xsequence/sequence-primitives'

export type Transaction = {
  to: Address.Address
  value?: bigint
  data?: Uint8Array
}

export type WalletOptions = {
  row: WalletRow
  relayers: Relayer.Relayer[]
}

export type RelayerOption = {
  id: string
  chainId: bigint
  txs: Transaction[]
  relayer: Relayer.Relayer
  feeOption?: Relayer.FeeOption
  quote?: Relayer.FeeQuote
}

export class Wallet {
  constructor(private readonly options: WalletOptions) {}

  get address(): Address.Address {
    return this.options.row.wallet
  }

  async sendTransaction(
    chainId: bigint,
    txs: Transaction[],
    selectRelayer: (feeOptions: RelayerOption[]) => Promise<string>,
    confirmCalls: (calls: Payload.Call[]) => Promise<Payload.Call[]>,
  ): Promise<void> {
    const calls = txs.map(
      (tx): Payload.Call => ({
        to: tx.to,
        value: tx.value ?? 0n,
        data: tx.data ?? new Uint8Array(0),
        gasLimit: 0n, // TODO: Add gas estimation
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }),
    )

    const confirmedCalls = await confirmCalls(calls)

    // We need to check that nothing has changed into `delegateCall: true`
    if (confirmedCalls.some((call) => call.delegateCall)) {
      throw new Error('Delegate calls are not allowed')
    }

    let idTag = Hex.random(8)
    let idCounter = 0

    const allRelayerOptions = await Promise.all(
      this.options.relayers.map(async (relayer): Promise<RelayerOption[]> => {
        const feeOptions = await relayer.feeOptions(this.address, chainId, confirmedCalls)

        if (feeOptions.options.length === 0) {
          return [
            {
              id: `${idTag}-${(idCounter++).toString()}`,
              chainId: chainId,
              txs: txs,
              relayer: relayer,
            } as RelayerOption,
          ]
        }

        return feeOptions.options.map((feeOption) => ({
          id: `${idTag}-${(idCounter++).toString()}`,
          chainId: chainId,
          txs: txs,
          feeOption: feeOption,
          relayer: relayer,
          quote: feeOptions.quote,
        }))
      }),
    )

    const allRelayerOptionsFlat = allRelayerOptions.flat()
    if (allRelayerOptionsFlat.length === 0) {
      throw new Error('No relayer options found')
    }

    const selected = await selectRelayer(allRelayerOptionsFlat)
    const found = allRelayerOptionsFlat.find((feeOption) => feeOption.id === selected)

    if (!found) {
      throw new Error('Selected fee option not found')
    }
  }
}

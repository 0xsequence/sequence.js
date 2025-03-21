import { Network, Payload } from '@0xsequence/sequence-primitives'
import * as Db from '../dbs'
import { Relayer, State, Wallet } from '@0xsequence/sequence-core'
import { Address, Provider } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Signatures } from './signatures'

export class Transactions {
  constructor(
    private readonly signatures: Signatures,
    private readonly transactionsDb: Db.Transactions,
    private readonly networks: Network.Network[],
    private readonly stateProvider: State.Provider,
    private readonly relayers: Relayer.Relayer[],
  ) {}

  public async list(): Promise<Db.TransactionRow[]> {
    return this.transactionsDb.list()
  }

  async request(
    from: Address.Address,
    chainId: bigint,
    txs: Db.TransactionRequest[],
    options?: {
      skipDefineGas?: boolean
      source?: string
    },
  ): Promise<string> {
    const network = this.networks.find((network) => network.chainId === chainId)
    if (!network) {
      throw new Error(`Network not found for ${chainId}`)
    }

    const provider = Provider.from(network.rpc)
    const wallet = new Wallet(from, { stateProvider: this.stateProvider })

    const calls = txs.map(
      (tx): Payload.Call => ({
        to: tx.to,
        value: tx.value ?? 0n,
        data: tx.data ?? new Uint8Array(0),
        gasLimit: tx.gasLimit ?? 0n, // TODO: Add gas estimation
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }),
    )

    const envelope = await wallet.prepareTransaction(provider, calls)

    const id = uuidv7()
    await this.transactionsDb.set({
      id,
      wallet: from,
      requests: txs,
      envelope,
      source: options?.source ?? 'unknown',
      status: 'requested',
    })

    return id
  }

  async define(
    transactionId: string,
    changes?: {
      nonce?: bigint
      space?: bigint
      calls?: Pick<Payload.Call, 'gasLimit'>[]
    },
  ): Promise<void> {
    const tx = await this.transactionsDb.get(transactionId)
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    if (tx.status !== 'requested') {
      throw new Error(`Transaction ${transactionId} is not in the requested state`)
    }

    // Modify the envelope with the changes
    if (changes?.nonce) {
      tx.envelope.payload.nonce = changes.nonce
    }

    if (changes?.space) {
      tx.envelope.payload.space = changes.space
    }

    if (changes?.calls) {
      if (changes.calls.length !== tx.envelope.payload.calls.length) {
        throw new Error(`Invalid number of calls for transaction ${transactionId}`)
      }

      for (let i = 0; i < changes.calls.length; i++) {
        tx.envelope.payload.calls[i]!.gasLimit = changes.calls[i]!.gasLimit
      }
    }

    await this.transactionsDb.set({
      ...tx,
      status: 'defined',
    })
  }

  async selectRelayer(
    transactionId: string,
    selectRelayer: (relayerOptions: Db.RelayerOption[]) => Promise<Db.RelayerOption | undefined>,
  ): Promise<string | undefined> {
    const tx = await this.transactionsDb.get(transactionId)
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    if (tx.status !== 'defined') {
      throw new Error(`Transaction ${transactionId} is not in the defined state`)
    }

    // Obtain the relayer options for the next stage
    const allRelayerOptions = await Promise.all(
      this.relayers.map(async (relayer): Promise<Db.RelayerOption[]> => {
        const feeOptions = await relayer.feeOptions(tx.wallet, tx.envelope.chainId, tx.envelope.payload.calls)

        if (feeOptions.options.length === 0) {
          return [
            {
              id: uuidv7(),
              relayerId: relayer.id,
            } as Db.RelayerOption,
          ]
        }

        return feeOptions.options.map((feeOption) => ({
          id: uuidv7(),
          feeOption: feeOption,
          relayerId: relayer.id,
          quote: feeOptions.quote,
        }))
      }),
    )

    const selection = await selectRelayer(allRelayerOptions.flat())
    if (!selection) {
      return
    }

    await this.transactionsDb.set({
      ...tx,
      relayerOption: selection,
      status: 'formed',
    })

    // Pass to the signatures manager
    return this.signatures.request(tx.envelope, {
      origin: tx.source,
      reason: 'transaction',
    })
  }
}

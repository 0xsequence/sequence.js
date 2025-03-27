import { Payload } from '@0xsequence/sequence-primitives'
import * as Db from '../dbs'
import { Wallet } from '@0xsequence/sequence-core'
import { Address, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager'
import { RelayerOption, Transaction, TransactionRequest } from './types/transactionRequest'

export class Transactions {
  constructor(private readonly shared: Shared) {}

  public async list(): Promise<Transaction[]> {
    return this.shared.databases.transactions.list()
  }

  public async get(transactionId: string): Promise<Transaction> {
    const tx = await this.shared.databases.transactions.get(transactionId)
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    return tx
  }

  async request(
    from: Address.Address,
    chainId: bigint,
    txs: TransactionRequest[],
    options?: {
      skipDefineGas?: boolean
      source?: string
    },
  ): Promise<string> {
    const network = this.shared.sequence.networks.find((network) => network.chainId === chainId)
    if (!network) {
      throw new Error(`Network not found for ${chainId}`)
    }

    const transport = RpcTransport.fromHttp(network.rpc)
    const provider = Provider.from(transport)
    const wallet = new Wallet(from, { stateProvider: this.shared.sequence.stateProvider })

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
    await this.shared.databases.transactions.set({
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
    const tx = await this.get(transactionId)
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

    await this.shared.databases.transactions.set({
      ...tx,
      status: 'defined',
    })
  }

  async selectRelayer(
    transactionId: string,
    selectRelayer: (relayerOptions: RelayerOption[]) => Promise<RelayerOption | undefined>,
  ): Promise<string | undefined> {
    const tx = await this.get(transactionId)
    if (tx.status !== 'defined') {
      throw new Error(`Transaction ${transactionId} is not in the defined state`)
    }

    // Obtain the relayer options for the next stage
    const allRelayerOptions = await Promise.all(
      this.shared.sequence.relayers.map(async (relayer): Promise<RelayerOption[]> => {
        const feeOptions = await relayer.feeOptions(tx.wallet, tx.envelope.chainId, tx.envelope.payload.calls)

        if (feeOptions.options.length === 0) {
          return [
            {
              id: uuidv7(),
              relayerId: relayer.id,
            } as RelayerOption,
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

    await this.shared.databases.transactions.set({
      ...tx,
      relayerOption: selection,
      status: 'formed',
    })

    // Pass to the signatures manager
    return this.shared.modules.signatures.request(tx.envelope, 'send-transaction', {
      origin: tx.source,
    })
  }

  onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean) {
    const undo = this.shared.databases.transactions.addListener(() => {
      this.list().then((l) => cb(l))
    })

    if (trigger) {
      this.list().then((l) => cb(l))
    }

    return undo
  }

  onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean) {
    const undo = this.shared.databases.transactions.addListener(() => {
      this.get(transactionId).then((t) => cb(t))
    })

    if (trigger) {
      this.get(transactionId).then((t) => cb(t))
    }

    return undo
  }

  async delete(transactionId: string) {
    await this.shared.databases.transactions.del(transactionId)
  }
}

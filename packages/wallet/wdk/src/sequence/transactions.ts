import { Payload } from '@0xsequence/wallet-primitives'
import { Envelope, Relayer, Wallet } from '@0xsequence/wallet-core'
import { Abi, AbiFunction, Address, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import {
  RelayerOption,
  Transaction,
  TransactionFormed,
  TransactionRelayed,
  TransactionRequest,
} from './types/transaction-request.js'

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
      noConfigUpdate?: boolean
      unsafe?: boolean
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
        data: tx.data ?? '0x',
        gasLimit: tx.gasLimit ?? 0n, // TODO: Add gas estimation
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }),
    )

    const envelope = await wallet.prepareTransaction(provider, calls, {
      noConfigUpdate: options?.noConfigUpdate,
      unsafe: options?.unsafe,
    })

    const id = uuidv7()
    await this.shared.databases.transactions.set({
      id,
      wallet: from,
      requests: txs,
      envelope,
      source: options?.source ?? 'unknown',
      status: 'requested',
      timestamp: Date.now(),
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

    // Get relayer options
    const allRelayerOptions = await Promise.all(
      this.shared.sequence.relayers
        // Filter relayers based on the chainId of the transaction
        .filter((relayer) =>
          relayer instanceof Relayer.Rpc.RpcRelayer ? BigInt(relayer.chainId) === tx.envelope.chainId : true,
        )
        .map(async (relayer): Promise<RelayerOption[]> => {
          const feeOptions = await relayer.feeOptions(tx.wallet, tx.envelope.chainId, tx.envelope.payload.calls)

          if (feeOptions.options.length === 0) {
            console.log('manual relayer', relayer)

            const { name, icon } = relayer instanceof Relayer.EIP6963.EIP6963Relayer ? relayer.info : {}

            return [
              {
                id: uuidv7(),
                relayerId: relayer.id,
                name,
                icon,
              } as RelayerOption,
            ]
          }

          return feeOptions.options.map((feeOption) => ({
            id: uuidv7(),
            feeOption,
            relayerId: relayer.id,
            quote: feeOptions.quote,
          }))
        }),
    )

    await this.shared.databases.transactions.set({
      ...tx,
      relayerOptions: allRelayerOptions.flat(),
      status: 'defined',
    })
  }

  async selectRelayer(transactionId: string, relayerOptionId: string): Promise<string> {
    const tx = await this.get(transactionId)
    if (tx.status !== 'defined') {
      throw new Error(`Transaction ${transactionId} is not in the defined state`)
    }

    const selection = tx.relayerOptions.find((option) => option.id === relayerOptionId)
    if (!selection) {
      throw new Error(`Relayer option ${relayerOptionId} not found for transaction ${transactionId}`)
    }

    // if we have a fee option on the selected relayer option
    if (selection.feeOption) {
      // then we need to prepend the transaction payload with the fee
      const { token, to, value, gasLimit } = selection.feeOption

      Address.assert(to)

      if (token === '0x0000000000000000000000000000000000000000') {
        tx.envelope.payload.calls.unshift({
          to,
          value: BigInt(value),
          data: '0x',
          gasLimit: BigInt(gasLimit),
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        })
      } else {
        const [transfer] = Abi.from(['function transfer(address to, uint256 amount) returns (bool)'])

        tx.envelope.payload.calls.unshift({
          to: token,
          value: 0n,
          data: AbiFunction.encodeData(transfer, [to, BigInt(value)]),
          gasLimit: BigInt(gasLimit),
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        })
      }
    }

    // Pass to the signatures manager
    const signatureId = await this.shared.modules.signatures.request(tx.envelope, 'send-transaction', {
      origin: tx.source,
    })

    await this.shared.databases.transactions.set({
      ...tx,
      relayerOptions: undefined,
      relayerOption: selection,
      status: 'formed',
      signatureId,
    } as TransactionFormed)

    return signatureId
  }

  async relay(transactionOrSignatureId: string) {
    // First, try to get the transaction directly
    let tx: Transaction | undefined
    try {
      tx = await this.get(transactionOrSignatureId)
    } catch (e) {
      // If not found, it might be a signature ID
      const signature = await this.shared.modules.signatures.get(transactionOrSignatureId)
      if (!signature) {
        throw new Error(`Neither transaction nor signature found with ID ${transactionOrSignatureId}`)
      }

      // Find the transaction associated with this signature
      const transactions = await this.list()
      tx = transactions.find(
        (t) => t.status === 'formed' && 'signatureId' in t && t.signatureId === transactionOrSignatureId,
      )

      if (!tx) {
        throw new Error(`No transaction found for signature ${transactionOrSignatureId}`)
      }
    }

    const transactionId = tx.id

    if (tx.status !== 'formed') {
      throw new Error(`Transaction ${transactionId} is not in the formed state`)
    }

    const signature = await this.shared.modules.signatures.get(tx.signatureId)
    if (!signature) {
      throw new Error(`Signature ${tx.signatureId} not found for transaction ${transactionId}`)
    }

    const network = this.shared.sequence.networks.find((network) => network.chainId === tx.envelope.chainId)
    if (!network) {
      throw new Error(`Network not found for ${tx.envelope.chainId}`)
    }

    const transport = RpcTransport.fromHttp(network.rpc)
    const provider = Provider.from(transport)

    const wallet = new Wallet(tx.wallet, { stateProvider: this.shared.sequence.stateProvider })
    if (!Payload.isCalls(signature.envelope.payload)) {
      throw new Error(`Signature ${tx.signatureId} is not a calls payload`)
    }

    if (!Envelope.isSigned(signature.envelope)) {
      throw new Error(`Transaction ${transactionId} is not signed`)
    }

    const { weight, threshold } = Envelope.weightOf(signature.envelope)
    if (weight < threshold) {
      throw new Error(`Transaction ${transactionId} has insufficient weight`)
    }

    const transaction = await wallet.buildTransaction(provider, signature.envelope as Envelope.Signed<Payload.Calls>)
    const relayer = this.shared.sequence.relayers.find((relayer) => relayer.id === tx.relayerOption.relayerId)

    if (!relayer) {
      throw new Error(`Relayer ${tx.relayerOption.relayerId} not found for transaction ${transactionId}`)
    }

    const { opHash } = await relayer.relay(
      transaction.to,
      transaction.data,
      tx.envelope.chainId,
      tx.relayerOption.quote,
    )

    await this.shared.databases.transactions.set({
      ...tx,
      status: 'relayed',
      opHash,
    } as TransactionRelayed)

    relayer.status(opHash, tx.envelope.chainId).then((opStatus) => {
      this.shared.databases.transactions.set({
        ...tx,
        status: 'relayed',
        opHash,
        opStatus,
      } as TransactionRelayed)
    })

    await this.shared.modules.signatures.complete(signature.id)

    return opHash
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
    const tx = await this.get(transactionId)
    await this.shared.databases.transactions.del(transactionId)

    // Cancel any signature requests associated with this transaction
    if (tx.status === 'formed') {
      await this.shared.modules.signatures.cancel(tx.signatureId)
    }
  }
}

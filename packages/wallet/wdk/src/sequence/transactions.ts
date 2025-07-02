import { Payload } from '@0xsequence/wallet-primitives'
import { Envelope, Relayer, Wallet } from '@0xsequence/wallet-core'
import { Abi, AbiFunction, Address, Hex, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import {
  ERC4337RelayerOption,
  LegacyRelayerOption,
  Transaction,
  TransactionFinal,
  TransactionFormed,
  TransactionRelayed,
  TransactionRequest,
} from './types/transaction-request.js'

export class Transactions {
  constructor(private readonly shared: Shared) {}

  initialize() {
    this.shared.modules.cron.registerJob('update-transaction-status', 1000, async () => {
      await this.refreshStatus()
    })
  }

  public async refreshStatus(onlyTxId?: string): Promise<number> {
    const transactions = await this.list()

    const THIRTY_MINUTES = 30 * 60 * 1000
    const now = Date.now()

    let finalCount = 0

    for (const tx of transactions) {
      if (onlyTxId && tx.id !== onlyTxId) {
        continue
      }

      if (tx.status === 'relayed') {
        let relayer: Relayer.Relayer | Relayer.Bundler | undefined = this.shared.sequence.relayers.find(
          (relayer) => relayer.id === tx.relayerId,
        )
        if (!relayer) {
          const bundler = this.shared.sequence.bundlers.find((bundler) => bundler.id === tx.relayerId)
          if (!bundler) {
            console.warn('relayer or bundler not found', tx.id, tx.relayerId)
            continue
          }

          relayer = bundler
        }

        // Check for timeout: if relayedAt is more than 30 minutes ago, fail with timeout
        if (typeof tx.relayedAt === 'number' && now - tx.relayedAt > THIRTY_MINUTES) {
          const opStatus = {
            status: 'failed',
            reason: 'timeout',
          }
          this.shared.databases.transactions.set({
            ...tx,
            opStatus,
            status: 'final',
          } as TransactionFinal)
          finalCount++
          continue
        }

        const opStatus = await relayer.status(tx.opHash as Hex.Hex, tx.envelope.chainId)

        if (opStatus.status === 'confirmed' || opStatus.status === 'failed') {
          this.shared.databases.transactions.set({
            ...tx,
            opStatus,
            status: 'final',
          } as TransactionFinal)
          finalCount++
        } else {
          this.shared.databases.transactions.set({
            ...tx,
            opStatus,
            status: 'relayed',
          } as TransactionRelayed)
        }
      }
    }

    return finalCount
  }

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
      space?: bigint
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
      space: options?.space !== undefined ? options.space : BigInt(Math.floor(Date.now() / 1000)),
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

    const wallet = new Wallet(tx.wallet, { stateProvider: this.shared.sequence.stateProvider })
    const provider = Provider.from(
      RpcTransport.fromHttp(
        this.shared.sequence.networks.find((network) => network.chainId === tx.envelope.chainId)!.rpc,
      ),
    )

    // Get relayer and relayer options
    const [allRelayerOptions, allBundlerOptions] = await Promise.all([
      Promise.all(
        this.shared.sequence.relayers
          // Filter relayers based on the chainId of the transaction
          .map(async (relayer): Promise<LegacyRelayerOption[]> => {
            const ifAvailable = await relayer.isAvailable(tx.wallet, tx.envelope.chainId)
            if (!ifAvailable) {
              return []
            }

            const feeOptions = await relayer.feeOptions(tx.wallet, tx.envelope.chainId, tx.envelope.payload.calls)

            if (feeOptions.options.length === 0) {
              const { name, icon } = relayer instanceof Relayer.EIP6963.EIP6963Relayer ? relayer.info : {}

              return [
                {
                  kind: 'legacy',
                  id: uuidv7(),
                  relayerId: relayer.id,
                  name,
                  icon,
                } as LegacyRelayerOption,
              ]
            }

            return feeOptions.options.map((feeOption) => ({
              kind: 'legacy',
              id: uuidv7(),
              feeOption,
              relayerId: relayer.id,
              quote: feeOptions.quote,
            }))
          }),
      ),
      (async () => {
        const entrypoint = await wallet.get4337Entrypoint(provider)
        if (!entrypoint) {
          return []
        }

        return Promise.all(
          this.shared.sequence.bundlers.map(async (bundler): Promise<ERC4337RelayerOption[]> => {
            const ifAvailable = await bundler.isAvailable(entrypoint, tx.envelope.chainId)
            if (!ifAvailable) {
              return []
            }

            try {
              const erc4337Op = await wallet.prepare4337Transaction(provider, tx.envelope.payload.calls, {
                space: tx.envelope.payload.space,
              })

              const erc4337OpsWithEstimatedLimits = await bundler.estimateLimits(tx.wallet, erc4337Op.payload)

              return erc4337OpsWithEstimatedLimits.map(({ speed, payload }) => ({
                kind: 'erc4337',
                id: uuidv7(),
                relayerId: bundler.id,
                alternativePayload: payload,
                speed,
              }))
            } catch (e) {
              console.error('error estimating limits 4337', e)
              return []
            }
          }),
        )
      })(),
    ])

    await this.shared.databases.transactions.set({
      ...tx,
      relayerOptions: [...allRelayerOptions.flat(), ...allBundlerOptions.flat()],
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
    if (selection.kind === 'legacy') {
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
    } else if (selection.kind === 'erc4337') {
      // Modify the envelope into a 4337 envelope
      tx.envelope = {
        ...tx.envelope,
        payload: selection.alternativePayload,
      } as Envelope.Envelope<Payload.Calls4337_07>
    } else {
      throw new Error(`Invalid relayer option ${(selection as any).kind}`)
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

    if (!Envelope.isSigned(signature.envelope)) {
      throw new Error(`Transaction ${transactionId} is not signed`)
    }

    const { weight, threshold } = Envelope.weightOf(signature.envelope)
    if (weight < threshold) {
      throw new Error(`Transaction ${transactionId} has insufficient weight`)
    }

    const relayer = [...this.shared.sequence.relayers, ...this.shared.sequence.bundlers].find(
      (relayer) => relayer.id === tx.relayerOption.relayerId,
    )

    if (!relayer) {
      throw new Error(`Relayer ${tx.relayerOption.relayerId} not found for transaction ${transactionId}`)
    }

    let opHash: string | undefined

    if (tx.relayerOption.kind === 'legacy') {
      if (!Relayer.isRelayer(relayer)) {
        throw new Error(`Relayer ${tx.relayerOption.relayerId} is not a legacy relayer`)
      }

      if (!Payload.isCalls(signature.envelope.payload)) {
        throw new Error(`Transaction ${transactionId} with legacy relayer is not a calls payload`)
      }

      const transaction = await wallet.buildTransaction(provider, {
        ...signature.envelope,
        payload: signature.envelope.payload,
      })

      const { opHash: opHashLegacy } = await relayer.relay(
        transaction.to,
        transaction.data,
        tx.envelope.chainId,
        tx.relayerOption.quote,
      )

      opHash = opHashLegacy

      await this.shared.databases.transactions.set({
        ...tx,
        status: 'relayed',
        opHash,
        relayedAt: Date.now(),
        relayerId: tx.relayerOption.relayerId,
      } as TransactionRelayed)

      await this.shared.modules.signatures.complete(signature.id)
    }

    if (tx.relayerOption.kind === 'erc4337') {
      if (!Relayer.isBundler(relayer)) {
        throw new Error(`Relayer ${tx.relayerOption.relayerId} is not a bundler`)
      }

      if (!Payload.isCalls4337_07(signature.envelope.payload)) {
        throw new Error(`Transaction ${transactionId} with bundler is not a calls4337_07 payload`)
      }

      const { operation, entrypoint } = await wallet.build4337Transaction(provider, {
        ...signature.envelope,
        payload: signature.envelope.payload,
      })

      const { opHash: opHashBundler } = await relayer.relay(entrypoint, operation)
      opHash = opHashBundler

      await this.shared.databases.transactions.set({
        ...tx,
        status: 'relayed',
        opHash,
        relayedAt: Date.now(),
        relayerId: tx.relayerOption.relayerId,
      } as TransactionRelayed)
    }

    if (!opHash) {
      throw new Error(`Relayer ${tx.relayerOption.relayerId} did not return an op hash`)
    }

    // Refresh the status of the transaction every second for the next 30 seconds
    const intervalId = setInterval(async () => {
      const finalCount = await this.refreshStatus(tx.id)
      if (finalCount > 0) {
        clearInterval(intervalId)
      }
    }, 1000)
    setTimeout(() => clearInterval(intervalId), 30 * 1000)

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

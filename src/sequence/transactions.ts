import { Envelope, Wallet, Bundler } from '@0xsequence/wallet-core'
import { Relayer } from '@0xsequence/relayer'
import { Constants, Payload } from '@0xsequence/wallet-primitives'
import { Abi, AbiFunction, Address, Hex, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import {
  ERC4337RelayerOption,
  isERC4337RelayerOption,
  isStandardRelayerOption,
  StandardRelayerOption,
  Transaction,
  TransactionFinal,
  TransactionFormed,
  TransactionRelayed,
  TransactionRequest,
} from './types/transaction-request.js'

export interface TransactionsInterface {
  /**
   * Retrieves the full state of a specific transaction by its ID.
   *
   * This method returns a `Transaction` object, which is a union type representing the
   * transaction's current stage in the lifecycle (`requested`, `defined`, `formed`, `relayed`, `final`).
   * The properties available on the returned object depend on its `status` property.
   * For example, a `defined` transaction will include `relayerOptions`, while a `final`
   * transaction will include the final on-chain `opStatus`.
   *
   * @param transactionId The unique identifier of the transaction to retrieve.
   * @returns A promise that resolves to the `Transaction` object.
   * @throws An error if the transaction is not found.
   * @see {Transaction} for the detailed structure of the returned object and its possible states.
   */
  get(transactionId: string): Promise<Transaction>

  /**
   * Initiates a new transaction, starting the transaction lifecycle.
   *
   * This method takes a set of simplified transaction requests, prepares a wallet-specific
   * transaction envelope, and stores it with a `requested` status.
   *
   * @param from The address of the wallet initiating the transaction.
   * @param chainId The chain ID on which the transaction will be executed.
   * @param txs An array of simplified transaction objects to be batched together.
   * @param options Configuration for the request.
   * @param options.source A string indicating the origin of the request (e.g., 'dapp-a.com', 'wallet-webapp').
   * @param options.noConfigUpdate If `true`, any pending on-chain wallet configuration updates will be
   *   skipped for this transaction. This is crucial for actions like recovery or session management
   *   where the active signer may not have permission to approve the main configuration update.
   *   Defaults to `false`, meaning updates are included by default.
   * @param options.unsafe If `true`, allows transactions that might be risky, such as calls from the
   *   wallet to itself (which can change its configuration) or delegate calls. Use with caution. Defaults to `false`.
   * @param options.space The nonce "space" for the transaction. Transactions in different spaces can be
   *   executed concurrently. If not provided, it defaults to the current timestamp.
   * @returns A promise that resolves to the unique `transactionId` for this new request.
   */
  request(
    from: Address.Address,
    chainId: number,
    txs: TransactionRequest[],
    options?: { source?: string; noConfigUpdate?: boolean; unsafe?: boolean; space?: bigint },
  ): Promise<string>

  /**
   * Finalizes the transaction's parameters and fetches relayer options.
   *
   * This moves a transaction from the `requested` to the `defined` state. In this step,
   * the SDK queries all available relayers (both standard and ERC-4337 bundlers) for
   * fee options and execution quotes. These options are then attached to the transaction object.
   *
   * @param transactionId The ID of the transaction to define.
   * @param changes (Optional) An object to override transaction parameters.
   *   - `nonce`: Override the automatically selected nonce.
   *   - `space`: Override the nonce space.
   *   - `calls`: Tweak the `gasLimit` for specific calls within the batch. The array must match the original call length.
   * @returns A promise that resolves when the transaction has been defined.
   * @throws An error if the transaction is not in the `requested` state.
   */
  define(
    transactionId: string,
    changes?: { nonce?: bigint; space?: bigint; calls?: Pick<Payload.Call, 'gasLimit'>[] },
  ): Promise<void>

  /**
   * Selects a relayer for the transaction and prepares it for signing.
   *
   * This moves a transaction from `defined` to `formed`. Based on the chosen `relayerOptionId`,
   * the transaction payload is finalized. If a standard relayer with a fee is chosen, the fee payment
   * is prepended to the transaction calls. If an ERC-4337 bundler is chosen, the entire payload is
   * transformed into a UserOperation-compatible format.
   *
   * This method creates a `SignatureRequest` and returns its ID. The next step is to use this ID
   * with the `Signatures` module to collect the required signatures.
   *
   * @param transactionId The ID of the `defined` transaction.
   * @param relayerOptionId The `id` of the desired relayer option from the `relayerOptions` array on the transaction object.
   * @returns A promise that resolves to the `signatureId` of the newly created signature request.
   * @throws An error if the transaction is not in the `defined` state.
   */
  selectRelayer(transactionId: string, relayerOptionId: string): Promise<string>

  /**
   * Relays a signed transaction to the network.
   *
   * This is the final step, submitting the transaction for execution. It requires that the
   * associated `SignatureRequest` has collected enough weight to meet the wallet's threshold.
   * The transaction's status transitions to `relayed` upon successful submission to the relayer,
   * and then asynchronously updates to `final` once it's confirmed or fails on-chain.
   *
   * The final on-chain status (`opStatus`) can be monitored using `onTransactionUpdate`.
   * Possible final statuses are:
   * - `confirmed`: The transaction succeeded. Includes the `transactionHash`.
   * - `failed`: The transaction was included in a block but reverted. Includes the `transactionHash` and `reason`.
   * If a transaction remains in `relayed` status for over 30 minutes, it will be marked as `failed` with a 'timeout' reason.
   *
   * @param transactionOrSignatureId The ID of the transaction to relay, or the ID of its associated signature request.
   * @returns A promise that resolves once the transaction is successfully submitted to the relayer.
   * @throws An error if the transaction is not in the `formed` state or if the signature threshold is not met.
   */
  relay(transactionOrSignatureId: string): Promise<void>

  /**
   * Deletes a transaction from the manager, regardless of its current state.
   *
   * If the transaction is in the `formed` state, this will also cancel the associated
   * signature request, preventing further signing.
   *
   * @param transactionId The ID of the transaction to delete.
   * @returns A promise that resolves when the transaction has been deleted.
   */
  delete(transactionId: string): Promise<void>

  /**
   * Subscribes to real-time updates for a single transaction.
   *
   * The callback is invoked whenever the transaction's state changes, such as transitioning
   * from `relayed` to `final`, or when its `opStatus` is updated. This is the recommended
   * way to monitor the progress of a relayed transaction.
   *
   * @param transactionId The ID of the transaction to monitor.
   * @param cb The callback function to execute with the updated `Transaction` object.
   * @param trigger (Optional) If `true`, the callback is immediately invoked with the current state.
   * @returns A function that, when called, unsubscribes the listener.
   */
  onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean): () => void

  /**
   * Subscribes to updates for the entire list of transactions managed by this instance.
   *
   * This is useful for UI components that display a history or list of all transactions,
   * ensuring the view stays synchronized as transactions are created, updated, or deleted.
   *
   * @param cb The callback function to execute with the full, updated list of transactions.
   * @param trigger (Optional) If `true`, the callback is immediately invoked with the current list.
   * @returns A function that, when called, unsubscribes the listener.
   */
  onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean): () => void
}

export class Transactions implements TransactionsInterface {
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
        let relayer: Relayer.Relayer | Bundler.Bundler | undefined = this.shared.sequence.relayers.find(
          (relayer) => relayer.id === tx.relayerId,
        )
        if (!relayer) {
          const bundler: Bundler.Bundler | undefined = this.shared.sequence.bundlers.find(
            (bundler) => bundler.id === tx.relayerId,
          )
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
    chainId: number,
    txs: TransactionRequest[],
    options?: {
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

    const transport = RpcTransport.fromHttp(network.rpcUrl)
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
    const network = this.shared.sequence.networks.find((network) => network.chainId === tx.envelope.chainId)
    if (!network) {
      throw new Error(`Network not found for ${tx.envelope.chainId}`)
    }
    const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))

    // Get relayer and relayer options
    const [allRelayerOptions, allBundlerOptions] = await Promise.all([
      Promise.all(
        this.shared.sequence.relayers
          // Filter relayers based on the chainId of the transaction
          .map(async (relayer): Promise<StandardRelayerOption[]> => {
            const ifAvailable = await relayer.isAvailable(tx.wallet, tx.envelope.chainId)
            if (!ifAvailable) {
              return []
            }

            const feeOptions = await relayer.feeOptions(tx.wallet, tx.envelope.chainId, tx.envelope.payload.calls)

            if (feeOptions.options.length === 0) {
              const { name, icon } = relayer instanceof Relayer.EIP6963.EIP6963Relayer ? relayer.info : {}

              return [
                {
                  kind: 'standard',
                  id: uuidv7(),
                  relayerType: relayer.type,
                  relayerId: relayer.id,
                  name,
                  icon,
                } as StandardRelayerOption,
              ]
            }

            return feeOptions.options.map((feeOption: Relayer.FeeOption) => ({
              kind: 'standard',
              id: uuidv7(),
              feeOption,
              relayerType: relayer.type,
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
          this.shared.sequence.bundlers.map(async (bundler: Bundler.Bundler): Promise<ERC4337RelayerOption[]> => {
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
                relayerType: 'erc4337',
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
    if (isStandardRelayerOption(selection)) {
      if (selection.feeOption) {
        // then we need to prepend the transaction payload with the fee
        const { token, to, value, gasLimit } = selection.feeOption

        Address.assert(to)

        if (token.contractAddress === Constants.ZeroAddress) {
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
            to: token.contractAddress as Address.Address,
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

    const transport = RpcTransport.fromHttp(network.rpcUrl)
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

    if (isStandardRelayerOption(tx.relayerOption)) {
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
    } else if (isERC4337RelayerOption(tx.relayerOption)) {
      if (!Bundler.isBundler(relayer)) {
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
    } else {
      throw new Error(`Invalid relayer option ${(tx.relayerOption as any).kind}`)
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

    if (!opHash) {
      throw new Error(`Relayer ${tx.relayerOption.relayerId} did not return an op hash`)
    }
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

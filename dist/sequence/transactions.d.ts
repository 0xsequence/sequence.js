import { Payload } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { Shared } from './manager.js';
import { Transaction, TransactionRequest } from './types/transaction-request.js';
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
    get(transactionId: string): Promise<Transaction>;
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
    request(from: Address.Address, chainId: number, txs: TransactionRequest[], options?: {
        source?: string;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
        space?: bigint;
    }): Promise<string>;
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
    define(transactionId: string, changes?: {
        nonce?: bigint;
        space?: bigint;
        calls?: Pick<Payload.Call, 'gasLimit'>[];
    }): Promise<void>;
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
    selectRelayer(transactionId: string, relayerOptionId: string): Promise<string>;
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
    relay(transactionOrSignatureId: string): Promise<void>;
    /**
     * Deletes a transaction from the manager, regardless of its current state.
     *
     * If the transaction is in the `formed` state, this will also cancel the associated
     * signature request, preventing further signing.
     *
     * @param transactionId The ID of the transaction to delete.
     * @returns A promise that resolves when the transaction has been deleted.
     */
    delete(transactionId: string): Promise<void>;
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
    onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean): () => void;
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
    onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean): () => void;
}
export declare class Transactions implements TransactionsInterface {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    refreshStatus(onlyTxId?: string): Promise<number>;
    list(): Promise<Transaction[]>;
    get(transactionId: string): Promise<Transaction>;
    request(from: Address.Address, chainId: number, txs: TransactionRequest[], options?: {
        source?: string;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
        space?: bigint;
    }): Promise<string>;
    define(transactionId: string, changes?: {
        nonce?: bigint;
        space?: bigint;
        calls?: Pick<Payload.Call, 'gasLimit'>[];
    }): Promise<void>;
    selectRelayer(transactionId: string, relayerOptionId: string): Promise<string>;
    relay(transactionOrSignatureId: string): Promise<void>;
    onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean): () => void;
    onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean): () => void;
    delete(transactionId: string): Promise<void>;
}
//# sourceMappingURL=transactions.d.ts.map
import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Shared } from './manager.js';
import { Module } from './types/index.js';
import { QueuedRecoveryPayload } from './types/recovery.js';
import { RecoverySigner } from './types/signer.js';
export interface RecoveryInterface {
    /**
     * Retrieves the list of configured recovery signers for a given wallet.
     *
     * Recovery signers are special-purpose keys (e.g., a secondary mnemonic or device) that can execute
     * transactions on a wallet's behalf after a mandatory time delay (timelock). This method reads the
     * wallet's current configuration, finds the recovery module, and returns a detailed list of these signers.
     *
     * @param wallet The on-chain address of the wallet to query.
     * @returns A promise that resolves to an array of `RecoverySigner` objects. If the wallet does not have
     *   the recovery module enabled, it returns `undefined`.
     * @see {RecoverySigner} for details on the returned object structure.
     */
    getSigners(wallet: Address.Address): Promise<RecoverySigner[] | undefined>;
    /**
     * Initiates the process of queuing a recovery payload for future execution. This is the first of a two-part
     * process to use the recovery mechanism.
     *
     * This method creates a special signature request that can *only* be signed by one of the wallet's designated
     * recovery signers. It does **not** send a transaction to the blockchain.
     *
     * @param wallet The address of the wallet that will be recovered.
     * @param chainId The chain ID on which the recovery payload is intended to be valid.
     * @param payload The transaction calls to be executed after the recovery timelock.
     * @returns A promise that resolves to a unique `requestId` for the signature request. This ID is then used
     *   with the signing UI and `completePayload`.
     * @see {completePayload} for the next step.
     */
    queuePayload(wallet: Address.Address, chainId: number, payload: Payload.Calls): Promise<string>;
    /**
     * Finalizes a queued recovery payload request and returns the transaction data needed to start the timelock on-chain.
     *
     * This method must be called after the `requestId` from `queuePayload` has been successfully signed by a
     * recovery signer. It constructs the calldata for a transaction to the Recovery contract.
     *
     * **Note:** This method does *not* send the transaction. It is the developer's responsibility to take the
     * returned `to` and `data` and submit it to the network.
     *
     * When the timelock has passed, the transaction can be sent using the Recovery handler. To do this, a transaction
     * with the same original payload must be constructed, and the Recovery handler will become available to sign.
     *
     * The Recovery handler has sufficient weight to sign the transaction by itself, but it will only do so after
     * the timelock has passed, and only if the payload being sent matches the original one that was queued.
     *
     * @param requestId The ID of the fulfilled signature request from `queuePayload`.
     * @returns A promise that resolves to an object containing the `to` (the Recovery contract address) and `data`
     *   (the encoded calldata) for the on-chain queuing transaction.
     * @throws An error if the `requestId` is invalid, not for a recovery action, or not fully signed.
     */
    completePayload(requestId: string): Promise<{
        to: Address.Address;
        data: Hex.Hex;
    }>;
    /**
     * Initiates a configuration update to add a new mnemonic as a recovery signer for a wallet.
     * This mnemonic is intended for emergency use and is protected by the wallet's recovery timelock.
     *
     * This action requires a signature from the wallet's *primary* signers (e.g., login keys, devices),
     * not the recovery signers.
     *
     * @param wallet The address of the wallet to modify.
     * @param mnemonic The mnemonic phrase to add as a new recovery signer.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {completeUpdate} to finalize this change after it has been signed.
     */
    addMnemonic(wallet: Address.Address, mnemonic: string): Promise<string>;
    /**
     * Initiates a configuration update to add any generic address as a recovery signer.
     *
     * This is useful for adding other wallets or third-party keys as recovery agents. Note that if you add a key
     * for which the WDK does not have a registered `Handler`, you will need to manually implement the signing
     * flow for that key when it's time to use it for recovery.
     *
     * This action requires a signature from the wallet's *primary* signers.
     *
     * @param wallet The address of the wallet to modify.
     * @param address The address of the new recovery signer to add.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {completeUpdate} to finalize this change after it has been signed.
     */
    addSigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    /**
     * Initiates a configuration update to remove a recovery signer from a wallet.
     *
     * This action requires a signature from the wallet's *primary* signers.
     *
     * @param wallet The address of the wallet to modify.
     * @param address The address of the recovery signer to remove.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {completeUpdate} to finalize this change after it has been signed.
     */
    removeSigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    /**
     * Finalizes and saves a pending recovery configuration update.
     *
     * This method should be called after a signature request from `addMnemonic`, `addSigner`, or `removeSigner`
     * has been fulfilled. It saves the new configuration to the state provider, queuing it to be included in
     * the wallet's next regular transaction.
     *
     * **Important:** Initiating a new recovery configuration change (e.g., calling `addSigner`) will automatically
     * cancel any other pending configuration update for the same wallet, including those from other modules like
     * sessions. Only the most recent configuration change request will remain active.
     *
     * @param requestId The unique ID of the fulfilled signature request.
     * @returns A promise that resolves when the update has been successfully processed and saved.
     * @throws An error if the request is not a valid recovery update or has insufficient signatures.
     */
    completeUpdate(requestId: string): Promise<void>;
    /**
     * Fetches the on-chain state of all queued recovery payloads for all managed wallets and updates the local database.
     *
     * This is a crucial security function. It allows the WDK to be aware of any recovery attempts, including
     * potentially malicious ones. It is run periodically by a background job but can be called manually to
     * force an immediate refresh.
     *
     * @returns A promise that resolves when the update check is complete.
     * @see {onQueuedPayloadsUpdate} to listen for changes discovered by this method.
     */
    updateQueuedPayloads(): Promise<void>;
    /**
     * Subscribes to changes in the list of queued recovery payloads for a specific wallet or all wallets.
     *
     * This is the primary method for building a UI that monitors pending recovery actions. The callback is fired
     * whenever `updateQueuedPayloads` detects a change in the on-chain state.
     *
     * @param wallet (Optional) The address of a specific wallet to monitor. If omitted, the callback will receive
     *   updates for all managed wallets.
     * @param cb The callback function to execute with the updated list of `QueuedRecoveryPayload` objects.
     * @param trigger (Optional) If `true`, the callback is immediately invoked with the current state.
     * @returns A function that, when called, unsubscribes the listener.
     */
    onQueuedPayloadsUpdate(wallet: Address.Address | undefined, cb: (payloads: QueuedRecoveryPayload[]) => void, trigger?: boolean): () => void;
    /**
     * Fetches all queued recovery payloads for a specific wallet from the on-chain recovery contract.
     *
     * This method queries the Recovery contract across all configured networks to discover queued payloads
     * that were initiated by any of the wallet's recovery signers. It checks each recovery signer on each
     * network and retrieves all their queued payloads, including metadata such as timestamps and execution status.
     *
     * Unlike `updateQueuedPayloads`, this method only fetches data for a single wallet and does not update
     * the local database. It's primarily used internally by `updateQueuedPayloads` but can be called directly
     * for real-time queries without affecting the cached state.
     *
     * @param wallet The address of the wallet to fetch queued payloads for.
     * @returns A promise that resolves to an array of `QueuedRecoveryPayload` objects representing all
     *   currently queued recovery actions for the specified wallet across all networks.
     * @see {QueuedRecoveryPayload} for details on the returned object structure.
     * @see {updateQueuedPayloads} for the method that fetches payloads for all wallets and updates the database.
     */
    fetchQueuedPayloads(wallet: Address.Address): Promise<QueuedRecoveryPayload[]>;
}
export declare class Recovery implements RecoveryInterface {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    private updateRecoveryModule;
    initRecoveryModule(modules: Module[], address: Address.Address): Promise<void>;
    hasRecoveryModule(modules: Module[]): boolean;
    addRecoverySignerToModules(modules: Module[], address: Address.Address): Promise<void>;
    removeRecoverySignerFromModules(modules: Module[], address: Address.Address): Promise<void>;
    addMnemonic(wallet: Address.Address, mnemonic: string): Promise<string>;
    addSigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    removeSigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    completeUpdate(requestId: string): Promise<void>;
    getSigners(address: Address.Address): Promise<RecoverySigner[] | undefined>;
    queuePayload(wallet: Address.Address, chainId: number, payload: Payload.Calls): Promise<string>;
    completePayload(requestId: string): Promise<{
        to: Address.Address;
        data: Hex.Hex;
    }>;
    getQueuedRecoveryPayloads(wallet?: Address.Address, chainId?: number): Promise<QueuedRecoveryPayload[]>;
    onQueuedPayloadsUpdate(wallet: Address.Address | undefined, cb: (payloads: QueuedRecoveryPayload[]) => void, trigger?: boolean): () => void;
    updateQueuedPayloads(): Promise<void>;
    fetchQueuedPayloads(wallet: Address.Address, chainId?: number): Promise<QueuedRecoveryPayload[]>;
    encodeRecoverySignature(imageHash: Hex.Hex, signer: Address.Address): Promise<import("ox/Bytes").Bytes>;
}
//# sourceMappingURL=recovery.d.ts.map
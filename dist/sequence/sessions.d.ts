import { type ExplicitSession } from '@0xsequence/wallet-core';
import { Attestation, Config, Signature as SequenceSignature, SessionConfig } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { Shared } from './manager.js';
import { Module } from './types/index.js';
import { AuthorizeImplicitSessionArgs } from './types/sessions.js';
export interface SessionsInterface {
    /**
     * Retrieves the raw, detailed session topology for a given wallet.
     *
     * The session topology is a tree-like data structure that defines all session-related configurations for a wallet.
     * This includes the identity signer (the primary credential that authorizes sessions), the list of explicit
     * session keys with their permissions, and the blacklist of contracts forbidden from using implicit sessions.
     *
     * This method is useful for inspecting the low-level structure of the sessions extension.
     *
     * @param walletAddress The on-chain address of the wallet.
     * @returns A promise that resolves to the wallet's `SessionsTopology` object.
     * @throws An error if the wallet is not configured with a session manager or if the topology cannot be found.
     */
    getTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology>;
    /**
     * Initiates the authorization of an "implicit session".
     *
     * An implicit session allows a temporary key (`sessionAddress`) to sign on behalf of the wallet for specific,
     * pre-approved smart contracts without requiring an on-chain configuration change. This is achieved by having the
     * wallet's primary identity signer (e.g., a passkey, or the identity instrument) sign an "attestation".
     *
     * This method prepares the attestation and creates a signature request for the identity signer.
     * The returned `requestId` must be used to get the signature from the user.
     *
     * @param walletAddress The address of the wallet authorizing the session.
     * @param sessionAddress The address of the temporary key that will become the implicit session signer.
     * @param args The authorization arguments.
     * @param args.target A string, typically a URL, identifying the application or service (the "audience")
     *   that is being granted this session. This is a critical security parameter.
     * @param args.applicationData (Optional) Extra data that can be included in the attestation.
     * @returns A promise that resolves to a `requestId` for the signature request.
     * @see {completeAuthorizeImplicitSession} to finalize the process after signing.
     */
    prepareAuthorizeImplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, args: AuthorizeImplicitSessionArgs): Promise<string>;
    /**
     * Completes the authorization of an implicit session.
     *
     * This method should be called after the signature request from `prepareAuthorizeImplicitSession` has been
     * fulfilled by the user's identity signer. It finalizes the process and returns the signed attestation.
     *
     * The returned attestation and its signature are the credentials needed to initialize an `Implicit`
     * session signer, which can then be used by a dapp to interact with approved contracts.
     *
     * @param requestId The unique ID of the signature request returned by `prepareAuthorizeImplicitSession`.
     * @returns A promise that resolves to an object containing the signed `attestation` and the `signature` from the identity signer.
     * @throws An error if the signature request is not found or has not been successfully signed.
     */
    completeAuthorizeImplicitSession(requestId: string): Promise<{
        attestation: Attestation.Attestation;
        signature: SequenceSignature.RSY;
    }>;
    /**
     * Initiates an on-chain configuration update to add an "explicit session".
     *
     * An explicit session grants a specified key (`sessionAddress`) on-chain signing rights for the
     * wallet, constrained by a set of defined permissions. This gives the session key the ability to send
     * transactions on the wallet's behalf as long as they comply with the rules.
     *
     * This process is more powerful than creating an implicit session but requires explicit authorization.
     * This method prepares the configuration update and returns a `requestId` that must be signed and then
     * completed using the `complete` method.
     *
     * @param walletAddress The address of the wallet to modify.
     * @param permissions The set of rules and limits that will govern this session key's capabilities.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {complete} to finalize the update after it has been signed.
     */
    addExplicitSession(walletAddress: Address.Address, explicitSession: ExplicitSession): Promise<string>;
    /**
     * Initiates an on-chain configuration update to modify an existing "explicit session".
     *
     * This method atomically replaces the permissions for a given session key. If the session
     * key does not already exist, it will be added. This is the recommended way to update
     * permissions for an active session.
     *
     * Like adding a session, this requires a signed configuration update.
     *
     * @param walletAddress The address of the wallet to modify.
     * @param permissions The new, complete set of rules and limits for this session key.
     * @param origin Optional string to identify the source of the request.
     * @returns A promise that resolves to a `requestId` for the configuration update.
     * @see {complete} to finalize the update after it has been signed.
     */
    modifyExplicitSession(walletAddress: Address.Address, explicitSession: ExplicitSession, origin?: string): Promise<string>;
    /**
     * Initiates an on-chain configuration update to remove an explicit session key.
     *
     * This revokes all on-chain permissions for the specified `sessionAddress`, effectively disabling it.
     * Like adding a session, this requires a signed configuration update.
     *
     * @param walletAddress The address of the wallet to modify.
     * @param sessionAddress The address of the session signer to remove.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {complete} to finalize the update after it has been signed.
     */
    removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string>;
    /**
     * Initiates an on-chain configuration update to add a contract address to the implicit session blacklist.
     *
     * Once blacklisted, a contract cannot be the target of transactions signed by any implicit session key for this wallet.
     *
     * @param walletAddress The address of the wallet to modify.
     * @param address The contract address to add to the blacklist.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {complete} to finalize the update after it has been signed.
     */
    addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>;
    /**
     * Initiates an on-chain configuration update to remove a contract address from the implicit session blacklist.
     *
     * @param walletAddress The address of the wallet to modify.
     * @param address The contract address to remove from the blacklist.
     * @returns A promise that resolves to a `requestId` for the configuration update signature request.
     * @see {complete} to finalize the update after it has been signed.
     */
    removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>;
    /**
     * Finalizes and saves a pending  session configuration update.
     *
     * This method should be called after a signature request generated by `addExplicitSession`,
     * `removeExplicitSession`, `addBlacklistAddress`, or `removeBlacklistAddress` has been
     * successfully signed and has met its weight threshold. It takes the signed configuration
     * and saves it to the state provider, making it the new pending configuration for the wallet.
     * The next regular transaction will then automatically include this update.
     *
     * **Important:** Calling any of the four modification methods (`addExplicitSession`, etc.) will
     * automatically cancel any other pending configuration update for the same wallet. This is to
     * prevent conflicts and ensure only the most recent intended state is applied. For example, if you
     * call `addExplicitSession` and then `removeExplicitSession` before completing the first request,
     * the first signature request will be cancelled, and only the second one will remain active.
     *
     * @param requestId The unique ID of the fulfilled signature request.
     * @returns A promise that resolves when the update has been successfully processed and saved.
     * @throws An error if the request is not a 'session-update' action, is not found, or has insufficient signatures.
     */
    complete(requestId: string): Promise<void>;
}
export declare class Sessions implements SessionsInterface {
    private readonly shared;
    constructor(shared: Shared);
    getTopology(walletAddress: Address.Address, fixMissing?: boolean): Promise<SessionConfig.SessionsTopology>;
    private updateSessionModule;
    hasSessionModule(modules: Module[]): boolean;
    initSessionModule(modules: Module[], identitySigners: Address.Address[], guardTopology?: Config.Topology): Promise<void>;
    addIdentitySignerToModules(modules: Module[], address: Address.Address): Promise<void>;
    removeIdentitySignerFromModules(modules: Module[], address: Address.Address): Promise<void>;
    prepareAuthorizeImplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, args: AuthorizeImplicitSessionArgs): Promise<string>;
    completeAuthorizeImplicitSession(requestId: string): Promise<{
        attestation: Attestation.Attestation;
        signature: SequenceSignature.RSY;
    }>;
    addExplicitSession(walletAddress: Address.Address, explicitSession: ExplicitSession, origin?: string): Promise<string>;
    modifyExplicitSession(walletAddress: Address.Address, explicitSession: ExplicitSession, origin?: string): Promise<string>;
    removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, origin?: string): Promise<string>;
    addBlacklistAddress(walletAddress: Address.Address, address: Address.Address, origin?: string): Promise<string>;
    removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address, origin?: string): Promise<string>;
    private prepareSessionUpdate;
    complete(requestId: string): Promise<void>;
}
//# sourceMappingURL=sessions.d.ts.map
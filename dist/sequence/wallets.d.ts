import { Config } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { AuthCommitment } from '../dbs/auth-commitments.js';
import { Shared } from './manager.js';
import { Device } from './types/device.js';
import { Action, Module } from './types/index.js';
import { SignerWithKind } from './types/signer.js';
import { Wallet, WalletSelectionUiHandler } from './types/wallet.js';
export type StartSignUpWithRedirectArgs = {
    kind: 'google-pkce' | 'apple';
    target: string;
    metadata: {
        [key: string]: string;
    };
};
export type SignupStatus = {
    type: 'login-signer-created';
    address: Address.Address;
} | {
    type: 'device-signer-created';
    address: Address.Address;
} | {
    type: 'wallet-created';
    address: Address.Address;
} | {
    type: 'signup-completed';
} | {
    type: 'signup-aborted';
};
export type CommonSignupArgs = {
    use4337?: boolean;
    noGuard?: boolean;
    noSessionManager?: boolean;
    noRecovery?: boolean;
    onStatusChange?: (status: SignupStatus) => void;
};
export type PasskeySignupArgs = CommonSignupArgs & {
    kind: 'passkey';
    name?: string;
};
export type MnemonicSignupArgs = CommonSignupArgs & {
    kind: 'mnemonic';
    mnemonic: string;
};
export type EmailOtpSignupArgs = CommonSignupArgs & {
    kind: 'email-otp';
    email: string;
};
export type CompleteRedirectArgs = CommonSignupArgs & {
    state: string;
    code: string;
};
export type AuthCodeSignupArgs = CommonSignupArgs & {
    kind: 'google-pkce' | 'apple';
    commitment: AuthCommitment;
    code: string;
    target: string;
    isRedirect: boolean;
};
export type SignupArgs = PasskeySignupArgs | MnemonicSignupArgs | EmailOtpSignupArgs | AuthCodeSignupArgs;
export type LoginToWalletArgs = {
    wallet: Address.Address;
};
export type LoginToMnemonicArgs = {
    kind: 'mnemonic';
    mnemonic: string;
    selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>;
};
export type LoginToPasskeyArgs = {
    kind: 'passkey';
    credentialId?: string;
    selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>;
};
export type LoginArgs = LoginToWalletArgs | LoginToMnemonicArgs | LoginToPasskeyArgs;
export interface WalletsInterface {
    /**
     * Checks if a wallet is currently managed and logged in within this manager instance.
     *
     * This method queries the local database to see if there is an active session for the given wallet address.
     * It's important to note that a `false` return value does not mean the wallet doesn't exist on-chain;
     * it simply means this specific browser/device does not have a logged-in session for it.
     *
     * @param wallet The address of the wallet to check.
     * @returns A promise that resolves to `true` if the wallet is managed, `false` otherwise.
     */
    has(wallet: Address.Address): Promise<boolean>;
    /**
     * Retrieves the details of a managed wallet.
     *
     * This method returns the stored `Wallet` object, which contains information about the session,
     * such as its status (`ready`, `logging-in`, `logging-out`), the device address used for this session,
     * the login method (`mnemonic`, `passkey`, etc.), and the login date.
     *
     * @param walletAddress The address of the wallet to retrieve.
     * @returns A promise that resolves to the `Wallet` object if found, or `undefined` if the wallet is not managed.
     * @see {Wallet} for details on the returned object structure.
     */
    get(walletAddress: Address.Address): Promise<Wallet | undefined>;
    /**
     * Lists all wallets that are currently managed and logged in by this manager instance.
     *
     * @returns A promise that resolves to an array of `Wallet` objects.
     */
    list(): Promise<Wallet[]>;
    /**
     * Lists all device keys currently authorized in the wallet's on-chain configuration.
     *
     * This method inspects the wallet's configuration to find all signers that
     * have been identified as 'local-device' keys. It also indicates which of
     * these keys corresponds to the current, active session.
     *
     * @param wallet The address of the wallet to query.
     * @returns A promise that resolves to an array of `Device` objects.
     */
    listDevices(wallet: Address.Address): Promise<Device[]>;
    /**
     * Registers a UI handler for wallet selection.
     *
     * Some authentication methods (like emails or social logins) can be associated with multiple wallets.
     * When a user attempts to sign up with a credential that already has wallets, this handler is invoked
     * to prompt the user to either select an existing wallet to log into or confirm the creation of a new one.
     *
     * If no handler is registered, the system will default to creating a new wallet.
     * Only one handler can be registered per manager instance.
     *
     * @param handler A function that receives `WalletSelectionOptions` and prompts the user for a decision.
     * It should return the address of the selected wallet, or `undefined` to proceed with new wallet creation.
     * @returns A function to unregister the provided handler.
     */
    registerWalletSelector(handler: WalletSelectionUiHandler): () => void;
    /**
     * Unregisters the currently active wallet selection UI handler.
     *
     * @param handler (Optional) If provided, it will only unregister if the given handler is the one currently registered.
     * This prevents accidentally unregistering a handler set by another part of the application.
     */
    unregisterWalletSelector(handler?: WalletSelectionUiHandler): void;
    /**
     * Subscribes to updates for the list of managed wallets.
     *
     * The provided callback function is invoked whenever a wallet is added (login), removed (logout),
     * or has its status updated (e.g., from 'logging-in' to 'ready').
     *
     * @param cb The callback function to execute with the updated list of wallets.
     * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current list of wallets upon registration.
     * @returns A function to unsubscribe the listener.
     */
    onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean): () => void;
    /**
     * Creates and configures a new Sequence wallet.
     *
     * This method manages the full sign-up process, including generating a login signer, creating a device key,
     * building the wallet's on-chain configuration, deploying the wallet, and storing the session locally.
     *
     * If a wallet selection UI handler is registered, it will be invoked if the provided credential is already associated
     * with one or more existing wallets. The handler can return:
     *   - `'create-new'`: The sign-up process continues and a new wallet is created. The method resolves to the new wallet address.
     *   - `'abort-signup'`: The sign-up process is cancelled and the method returns `undefined`. To log in to an existing wallet,
     *     the client must call the `login` method separately with the desired wallet address.
     * If no handler is registered, a new wallet is always created.
     *
     * @param args The sign-up arguments, specifying the method and options.
     *   - `kind: 'mnemonic'`: Uses a mnemonic phrase as the login credential.
     *   - `kind: 'passkey'`: Prompts the user to create a WebAuthn passkey.
     *   - `kind: 'email-otp'`: Initiates an OTP flow to the user's email.
     *   - `kind: 'google-pkce' | 'apple'`: Completes an OAuth redirect flow.
     *   Common options like `noGuard` or `noRecovery` can customize the wallet's security features.
     * @returns A promise that resolves to the address of the newly created wallet, or `undefined` if the sign-up was aborted.
     * @see {SignupArgs}
     */
    signUp(args: SignupArgs): Promise<Address.Address | undefined>;
    /**
     * Initiates a sign-up or login process that involves an OAuth redirect.
     *
     * This is the first step for social logins (e.g., Google, Apple). It generates the necessary
     * challenges and state, stores them locally, and returns a URL. Your application should
     * redirect the user to this URL to continue the authentication process with the third-party provider.
     *
     * @param args Arguments specifying the provider (`kind`) and the `target` URL for the provider to redirect back to.
     * @returns A promise that resolves to the full OAuth URL to which the user should be redirected.
     * @see {completeRedirect} for the second step of this flow.
     */
    startSignUpWithRedirect(args: StartSignUpWithRedirectArgs): Promise<string>;
    /**
     * Completes an OAuth redirect flow after the user returns to the application.
     *
     * After the user authenticates with the third-party provider and is redirected back, your application
     * must call this method with the `state` and `code` parameters from the URL query string.
     * This method verifies the state, exchanges the code for a token, and completes the sign-up or login process.
     *
     * @param args The arguments containing the `state` and `code` from the redirect, along with original sign-up options.
     * @returns A promise that resolves to target path that should be redirected to.
     */
    completeRedirect(args: CompleteRedirectArgs): Promise<string>;
    /**
     * Initiates the login process for an existing wallet by adding the current device as a new signer.
     *
     * This method is for adding a new device/session to a wallet that has already been created. It generates a
     * configuration update transaction to add the new device key to the wallet's on-chain topology.
     * This configuration change requires a signature from an existing authorized signer.
     *
     * The `args` can be one of:
     * - `LoginToWalletArgs`: Login to a known wallet address.
     * - `LoginToMnemonicArgs` / `LoginToPasskeyArgs`: "Discover" wallets associated with a credential,
     *   prompt the user to select one via the `selectWallet` callback, and then log in.
     *
     * @param args The login arguments.
     * @returns A promise that resolves to a `requestId`. This ID represents the signature request for the
     *          configuration update, which must be signed by an existing key to authorize the new device.
     * @see {completeLogin}
     */
    login(args: LoginArgs): Promise<string>;
    /**
     * Completes the login process after the configuration update has been signed.
     *
     * After `login` is called and the resulting signature request is fulfilled, this method should be called
     * with the `requestId`. It submits the signed configuration update to the key tracker, finalizing the
     * addition of the new device. The wallet's local status is then set to 'ready'.
     *
     * @param requestId The ID of the completed signature request returned by `login`.
     * @returns A promise that resolves when the login process is fully complete and the wallet is ready for use.
     */
    completeLogin(requestId: string): Promise<void>;
    /**
     * Logs out from a given wallet, ending the current session.
     *
     * This method has two modes of operation:
     * 1. **Hard Logout (default):** Initiates a key tracker update to remove the current device's key
     *    from the wallet's configuration. This is the most secure option as it revokes the key's access
     *    entirely. This returns a `requestId` that must be signed and completed via `completeLogout`.
     * 2. **Soft Logout (`skipRemoveDevice: true`):** Immediately deletes the session and device key from local
     *    storage only. This is faster as it requires no transaction, but the device key remains authorized.
     *    This is suitable for clearing a session on a trusted device without revoking the key itself.
     *
     * @param wallet The address of the wallet to log out from.
     * @param options (Optional) Configuration for the logout process.
     * @returns If `skipRemoveDevice` is `true`, returns `Promise<undefined>`. Otherwise, returns a `Promise<string>`
     *          containing the `requestId` for the on-chain logout transaction.
     */
    logout<T extends {
        skipRemoveDevice?: boolean;
    } | undefined = undefined>(wallet: Address.Address, options?: T): Promise<T extends {
        skipRemoveDevice: true;
    } ? undefined : string>;
    /**
     * Initiates a remote logout process for a given wallet.
     *
     * This method is used to log out a device from a wallet that is not the local device.
     *
     * @param wallet The address of the wallet to log out from.
     * @param deviceAddress The address of the device to log out.
     * @returns A promise that resolves to a `requestId` for the on-chain logout transaction.
     */
    remoteLogout(wallet: Address.Address, deviceAddress: Address.Address): Promise<string>;
    /**
     * Completes the "hard logout" process.
     *
     * If `logout` was called without `skipRemoveDevice: true`, the resulting configuration update must be signed.
     * Once signed, this method takes the `requestId`, broadcasts the transaction to the network, and upon completion,
     * removes all local data associated with the wallet and device.
     *
     * @param requestId The ID of the completed signature request returned by `logout`.
     * @param options (Optional) Advanced options for completing the logout.
     * @returns A promise that resolves when the on-chain update is submitted and local storage is cleared.
     */
    completeLogout(requestId: string, options?: {
        skipValidateSave?: boolean;
    }): Promise<void>;
    /**
     * Completes a generic configuration update after it has been signed.
     *
     * This method takes a requestId for any action that results in a configuration
     * update (e.g., from `login`, `logout`, `remoteLogout`, `addSigner`, etc.),
     * validates it, and saves the new configuration to the state provider. The
     * update will be bundled with the next on-chain transaction.
     *
     * @param requestId The ID of the completed signature request.
     * @returns A promise that resolves when the update has been processed.
     */
    completeConfigurationUpdate(requestId: string): Promise<void>;
    /**
     * Retrieves the full, resolved configuration of a wallet.
     *
     * This method provides a detailed view of the wallet's structure, including lists of login signers,
     * device signers and a guard signer with their "kind" (e.g., 'local-device', 'login-passkey') resolved.
     * Additionally, each module with a guard signer will have its guard signer resolved in the `moduleGuards` map,
     * where the key is the module address and the value is the guard signer.
     * It also includes the raw, low-level configuration topology.
     *
     * @param wallet The address of the wallet.
     * @returns A promise that resolves to an object containing the resolved `devices`, `login` signers, and the `raw` configuration.
     */
    getConfiguration(wallet: Address.Address): Promise<{
        devices: SignerWithKind[];
        login: SignerWithKind[];
        walletGuard?: SignerWithKind;
        moduleGuards: Map<`0x${string}`, SignerWithKind>;
        raw: any;
    }>;
    /**
     * Fetches the current nonce of a wallet for a specific transaction space.
     *
     * Sequence wallets use a 2D nonce system (`space`, `nonce`) to prevent replay attacks and allow
     * for concurrent transactions. This method reads the current nonce for a given space directly from the blockchain.
     *
     * @param chainId The chain ID of the network to query.
     * @param address The address of the wallet.
     * @param space A unique identifier for a transaction category or flow, typically a large random number.
     * @returns A promise that resolves to the `bigint` nonce for the given space.
     */
    getNonce(chainId: number, address: Address.Address, space: bigint): Promise<bigint>;
    /**
     * Checks if the wallet's on-chain configuration is up to date for a given chain.
     *
     * This method returns `true` if, on the specified chain, there are no pending configuration updates
     * in the state tracker that have not yet been applied to the wallet. In other words, it verifies
     * that the wallet's on-chain image hash matches the latest configuration image hash.
     *
     * @param wallet The address of the wallet to check.
     * @param chainId The chain ID of the network to check against.
     * @returns A promise that resolves to `true` if the wallet is up to date on the given chain, or `false` otherwise.
     */
    isUpdatedOnchain(wallet: Address.Address, chainId: number): Promise<boolean>;
}
export declare function isLoginToWalletArgs(args: LoginArgs): args is LoginToWalletArgs;
export declare function isLoginToMnemonicArgs(args: LoginArgs): args is LoginToMnemonicArgs;
export declare function isLoginToPasskeyArgs(args: LoginArgs): args is LoginToPasskeyArgs;
export declare function isAuthCodeArgs(args: SignupArgs): args is AuthCodeSignupArgs;
declare function fromConfig(config: Config.Config): {
    loginTopology: Config.Topology;
    devicesTopology: Config.Topology;
    modules: Module[];
    guardTopology?: Config.Topology;
};
export declare class Wallets implements WalletsInterface {
    private readonly shared;
    private walletSelectionUiHandler;
    private pendingMnemonicOrPasskeyLogin?;
    constructor(shared: Shared);
    has(wallet: Address.Address): Promise<boolean>;
    get(walletAddress: Address.Address): Promise<Wallet | undefined>;
    list(): Promise<Wallet[]>;
    listDevices(wallet: Address.Address): Promise<Device[]>;
    registerWalletSelector(handler: WalletSelectionUiHandler): () => void;
    unregisterWalletSelector(handler?: WalletSelectionUiHandler): void;
    onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean): () => void;
    private prepareSignUp;
    startSignUpWithRedirect(args: StartSignUpWithRedirectArgs): Promise<string>;
    completeRedirect(args: CompleteRedirectArgs): Promise<string>;
    signUp(args: SignupArgs): Promise<Address.Address | undefined>;
    getConfigurationParts(address: Address.Address): Promise<{
        loginTopology: Config.Topology;
        devicesTopology: Config.Topology;
        modules: Module[];
        guardTopology?: Config.Topology;
    }>;
    requestConfigurationUpdate(address: Address.Address, changes: Partial<ReturnType<typeof fromConfig>>, action: Action, origin?: string): Promise<string>;
    completeConfigurationUpdate(requestId: string): Promise<void>;
    login(args: LoginArgs): Promise<string>;
    completeLogin(requestId: string): Promise<void>;
    logout<T extends {
        skipRemoveDevice?: boolean;
    } | undefined = undefined>(wallet: Address.Address, options?: T): Promise<T extends {
        skipRemoveDevice: true;
    } ? undefined : string>;
    remoteLogout(wallet: Address.Address, deviceAddress: Address.Address): Promise<string>;
    completeLogout(requestId: string, options?: {
        skipValidateSave?: boolean;
    }): Promise<void>;
    getConfiguration(wallet: Address.Address): Promise<{
        devices: SignerWithKind[];
        login: SignerWithKind[];
        walletGuard: SignerWithKind | undefined;
        moduleGuards: Map<`0x${string}`, SignerWithKind>;
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Module[];
            guardTopology?: Config.Topology;
        };
    }>;
    getNonce(chainId: number, address: Address.Address, space: bigint): Promise<bigint>;
    getOnchainConfiguration(wallet: Address.Address, chainId: number): Promise<{
        devices: SignerWithKind[];
        login: SignerWithKind[];
        guard: SignerWithKind[];
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Module[];
            guardTopology?: Config.Topology;
        };
    }>;
    isUpdatedOnchain(wallet: Address.Address, chainId: number): Promise<boolean>;
    private _prepareDeviceRemovalUpdate;
}
export {};
//# sourceMappingURL=wallets.d.ts.map
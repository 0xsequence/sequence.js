import { Config, Context, Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives';
import { Address, Bytes, Hex, Provider } from 'ox';
import * as Envelope from './envelope.js';
import * as State from './state/index.js';
import { UserOperation } from 'ox/erc4337';
export type WalletOptions = {
    knownContexts: Context.KnownContext[];
    stateProvider: State.Provider;
    guest: Address.Address;
    unsafe?: boolean;
};
export declare const DefaultWalletOptions: WalletOptions;
export type WalletStatus = {
    address: Address.Address;
    isDeployed: boolean;
    implementation?: Address.Address;
    configuration: Config.Config;
    imageHash: Hex.Hex;
    /** Pending updates in reverse chronological order (newest first) */
    pendingUpdates: Array<{
        imageHash: Hex.Hex;
        signature: SequenceSignature.RawSignature;
    }>;
    chainId?: number;
    counterFactual: {
        context: Context.KnownContext | Context.Context;
        imageHash: Hex.Hex;
    };
};
export type WalletStatusWithOnchain = WalletStatus & {
    onChainImageHash: Hex.Hex;
    stage: 'stage1' | 'stage2';
    context: Context.KnownContext | Context.Context;
};
export declare class Wallet {
    readonly address: Address.Address;
    readonly guest: Address.Address;
    readonly stateProvider: State.Provider;
    readonly knownContexts: Context.KnownContext[];
    constructor(address: Address.Address, options?: Partial<WalletOptions>);
    /**
     * Creates a new counter-factual wallet using the provided configuration.
     * Saves the wallet in the state provider, so you can get its imageHash from its address,
     * and its configuration from its imageHash.
     *
     * @param configuration - The wallet configuration to use.
     * @param options - Optional wallet options.
     * @returns A Promise that resolves to the new Wallet instance.
     */
    static fromConfiguration(configuration: Config.Config, options?: Partial<WalletOptions> & {
        context?: Context.Context;
    }): Promise<Wallet>;
    isDeployed(provider: Provider.Provider): Promise<boolean>;
    buildDeployTransaction(): Promise<{
        to: Address.Address;
        data: Hex.Hex;
    }>;
    /**
     * Prepares an envelope for updating the wallet's configuration.
     *
     * This function creates the necessary envelope that must be signed in order to update
     * the configuration of a wallet. If the `unsafe` option is set to true, no sanity checks
     * will be performed on the provided configuration. Otherwise, the configuration will be
     * validated for safety (e.g., weights, thresholds).
     *
     * Note: This function does not directly update the wallet's configuration. The returned
     * envelope must be signed and then submitted using the `submitUpdate` method to apply
     * the configuration change.
     *
     * @param configuration - The new wallet configuration to be proposed.
     * @param options - Options for preparing the update. If `unsafe` is true, skips safety checks.
     * @returns A promise that resolves to an unsigned envelope for the configuration update.
     */
    prepareUpdate(configuration: Config.Config, options?: {
        unsafe?: boolean;
    }): Promise<Envelope.Envelope<Payload.ConfigUpdate>>;
    submitUpdate(envelope: Envelope.Signed<Payload.ConfigUpdate>, options?: {
        noValidateSave?: boolean;
    }): Promise<void>;
    getStatus<T extends Provider.Provider | undefined = undefined>(provider?: T): Promise<T extends Provider.Provider ? WalletStatusWithOnchain : WalletStatus>;
    getNonce(provider: Provider.Provider, space: bigint): Promise<bigint>;
    get4337Nonce(provider: Provider.Provider, entrypoint: Address.Address, space: bigint): Promise<bigint>;
    get4337Entrypoint(provider: Provider.Provider): Promise<Address.Address | undefined>;
    prepare4337Transaction(provider: Provider.Provider, calls: Payload.Call[], options: {
        space?: bigint;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
    }): Promise<Envelope.Envelope<Payload.Calls4337_07>>;
    build4337Transaction(provider: Provider.Provider, envelope: Envelope.Signed<Payload.Calls4337_07>): Promise<{
        operation: UserOperation.RpcV07;
        entrypoint: Address.Address;
    }>;
    prepareTransaction(provider: Provider.Provider, calls: Payload.Call[], options?: {
        space?: bigint;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
    }): Promise<Envelope.Envelope<Payload.Calls>>;
    buildTransaction(provider: Provider.Provider, envelope: Envelope.Signed<Payload.Calls>): Promise<{
        to: `0x${string}`;
        data: `0x${string}`;
    }>;
    prepareMessageSignature(message: string | Hex.Hex | Payload.TypedDataToSign, chainId: number): Promise<Envelope.Envelope<Payload.Message>>;
    buildMessageSignature(envelope: Envelope.Signed<Payload.Message>, provider?: Provider.Provider): Promise<Bytes.Bytes>;
    private prepareBlankEnvelope;
}
//# sourceMappingURL=wallet.d.ts.map
import { Config, Context, Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives';
import { Address, Bytes, Hex, Provider } from 'ox';
import * as Envelope from './envelope.js';
import * as State from './state/index.js';
export type WalletOptions = {
    context: Context.Context;
    stateProvider: State.Provider;
    guest: Address.Address;
};
export declare const DefaultWalletOptions: WalletOptions;
export type WalletStatus = {
    address: Address.Address;
    isDeployed: boolean;
    implementation?: Address.Address;
    stage?: 'stage1' | 'stage2';
    configuration: Config.Config;
    imageHash: Hex.Hex;
    /** Pending updates in reverse chronological order (newest first) */
    pendingUpdates: Array<{
        imageHash: Hex.Hex;
        signature: SequenceSignature.RawSignature;
    }>;
    chainId?: bigint;
};
export type WalletStatusWithOnchain = WalletStatus & {
    onChainImageHash: Hex.Hex;
};
export declare class Wallet {
    readonly address: Address.Address;
    readonly context: Context.Context;
    readonly guest: Address.Address;
    readonly stateProvider: State.Provider;
    constructor(address: Address.Address, options?: Partial<WalletOptions>);
    static fromConfiguration(configuration: Config.Config, options?: Partial<WalletOptions>): Promise<Wallet>;
    isDeployed(provider: Provider.Provider): Promise<boolean>;
    buildDeployTransaction(): Promise<{
        to: Address.Address;
        data: Hex.Hex;
    }>;
    prepareUpdate(configuration: Config.Config): Promise<Envelope.Envelope<Payload.ConfigUpdate>>;
    submitUpdate(envelope: Envelope.Signed<Payload.ConfigUpdate>, options?: {
        validateSave?: boolean;
    }): Promise<void>;
    getStatus<T extends Provider.Provider | undefined = undefined>(provider?: T): Promise<T extends Provider.Provider ? WalletStatusWithOnchain : WalletStatus>;
    getNonce(provider: Provider.Provider, space: bigint): Promise<bigint>;
    prepareTransaction(provider: Provider.Provider, calls: Payload.Call[], options?: {
        space?: bigint;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
    }): Promise<Envelope.Envelope<Payload.Calls>>;
    buildTransaction(provider: Provider.Provider, envelope: Envelope.Signed<Payload.Calls>): Promise<{
        to: `0x${string}`;
        data: `0x${string}`;
    }>;
    prepareMessageSignature(message: string | Hex.Hex | Payload.TypedDataToSign, chainId: bigint): Promise<Envelope.Envelope<Payload.Message>>;
    buildMessageSignature(envelope: Envelope.Signed<Payload.Message>, provider?: Provider.Provider): Promise<Bytes.Bytes>;
    private prepareBlankEnvelope;
}
//# sourceMappingURL=wallet.d.ts.map
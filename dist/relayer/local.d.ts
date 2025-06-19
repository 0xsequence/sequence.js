import { Payload } from '@0xsequence/wallet-primitives';
import { EIP1193Provider } from 'mipd';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer.js';
import { IntentPrecondition } from './rpc/relayer.gen.js';
type GenericProviderTransactionReceipt = 'success' | 'failed' | 'unknown';
export interface GenericProvider {
    sendTransaction(args: {
        to: Address.Address;
        data: Hex.Hex;
    }, chainId: bigint): Promise<string | undefined>;
    getBalance(address: Address.Address): Promise<bigint>;
    call(args: {
        to: Address.Address;
        data: Hex.Hex;
    }): Promise<string>;
    getTransactionReceipt(txHash: Hex.Hex, chainId: bigint): Promise<GenericProviderTransactionReceipt>;
}
export declare class LocalRelayer implements Relayer {
    readonly provider: GenericProvider;
    readonly id = "local";
    constructor(provider: GenericProvider);
    static createFromWindow(window: Window): LocalRelayer | undefined;
    static createFromProvider(provider: EIP1193Provider): LocalRelayer;
    feeOptions(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    private decodeCalls;
    relay(to: Address.Address, data: Hex.Hex, chainId: bigint, quote?: FeeQuote, preconditions?: IntentPrecondition[], checkInterval?: number): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus>;
    checkPrecondition(precondition: IntentPrecondition): Promise<boolean>;
}
export declare class EIP1193ProviderAdapter implements GenericProvider {
    private readonly provider;
    constructor(provider: EIP1193Provider);
    private trySwitchChain;
    sendTransaction(args: {
        to: Address.Address;
        data: Hex.Hex;
    }, chainId: bigint): Promise<`0x${string}` | undefined>;
    getBalance(address: Address.Address): Promise<bigint>;
    call(args: {
        to: Address.Address;
        data: Hex.Hex;
    }): Promise<`0x${string}`>;
    getTransactionReceipt(txHash: Hex.Hex, chainId: bigint): Promise<"success" | "unknown" | "failed">;
}
export {};
//# sourceMappingURL=local.d.ts.map
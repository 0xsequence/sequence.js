import { Payload } from '@0xsequence/wallet-primitives';
import { EIP1193Provider } from 'mipd';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../index.js';
import { FeeToken, TransactionPrecondition } from '../rpc-relayer/relayer.gen.js';
type GenericProviderTransactionReceipt = 'success' | 'failed' | 'unknown';
export interface GenericProvider {
    sendTransaction(args: {
        to: Address.Address;
        data: Hex.Hex;
    }, chainId: number): Promise<string | undefined>;
    getBalance(address: Address.Address): Promise<bigint>;
    call(args: {
        to: Address.Address;
        data: Hex.Hex;
    }): Promise<string>;
    getTransactionReceipt(txHash: Hex.Hex, chainId: number): Promise<GenericProviderTransactionReceipt>;
}
export declare class LocalRelayer implements Relayer {
    readonly provider: GenericProvider;
    readonly kind: 'relayer';
    readonly type = "local";
    readonly id = "local";
    constructor(provider: GenericProvider);
    isAvailable(_wallet: Address.Address, _chainId: number): Promise<boolean>;
    static createFromWindow(window: Window): LocalRelayer | undefined;
    static createFromProvider(provider: EIP1193Provider): LocalRelayer;
    feeTokens(): Promise<{
        isFeeRequired: boolean;
        tokens?: FeeToken[];
        paymentAddress?: Address.Address;
    }>;
    feeOptions(wallet: Address.Address, chainId: number, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    private decodeCalls;
    relay(to: Address.Address, data: Hex.Hex, chainId: number, quote?: FeeQuote, preconditions?: TransactionPrecondition[], checkInterval?: number): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>;
    checkPrecondition(precondition: TransactionPrecondition): Promise<boolean>;
}
export declare class EIP1193ProviderAdapter implements GenericProvider {
    private readonly provider;
    constructor(provider: EIP1193Provider);
    private trySwitchChain;
    sendTransaction(args: {
        to: Address.Address;
        data: Hex.Hex;
    }, chainId: number): Promise<`0x${string}` | undefined>;
    getBalance(address: Address.Address): Promise<bigint>;
    call(args: {
        to: Address.Address;
        data: Hex.Hex;
    }): Promise<`0x${string}`>;
    getTransactionReceipt(txHash: Hex.Hex, chainId: number): Promise<"success" | "unknown" | "failed">;
}
export {};
//# sourceMappingURL=local.d.ts.map
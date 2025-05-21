import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer.js';
type GenericProviderTransactionReceipt = 'success' | 'failed' | 'unknown';
export interface GenericProvider {
    sendTransaction(args: {
        to: string;
        data: string;
    }, chainId: bigint): Promise<string>;
    getTransactionReceipt(txHash: string, chainId: bigint): Promise<GenericProviderTransactionReceipt>;
}
export declare class LocalRelayer implements Relayer {
    readonly provider: GenericProvider;
    readonly id = "local";
    constructor(provider: GenericProvider);
    static createFromWindow(window: Window): LocalRelayer | undefined;
    feeOptions(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    private decodeCalls;
    relay(to: Address.Address, data: Hex.Hex, chainId: bigint, _?: FeeQuote): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus>;
}
export {};
//# sourceMappingURL=local.d.ts.map
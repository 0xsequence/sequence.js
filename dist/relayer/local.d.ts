import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer.js';
import { IntentPrecondition } from './rpc/relayer.gen.js';
type GenericProviderTransactionReceipt = 'success' | 'failed' | 'unknown';
export interface GenericProvider {
    sendTransaction(args: {
        to: string;
        data: string;
    }, chainId: bigint): Promise<string>;
    getBalance(address: string): Promise<bigint>;
    call(args: {
        to: string;
        data: string;
    }): Promise<string>;
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
    relay(to: Address.Address, data: Hex.Hex, chainId: bigint, quote?: FeeQuote, preconditions?: IntentPrecondition[], checkInterval?: number): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus>;
    checkPrecondition(precondition: IntentPrecondition): Promise<boolean>;
}
export {};
//# sourceMappingURL=local.d.ts.map
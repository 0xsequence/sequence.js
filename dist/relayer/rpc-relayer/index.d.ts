import { FeeToken as RpcFeeToken, TransactionPrecondition } from './relayer.gen.js';
import { Address, Hex } from 'ox';
import { Payload } from '@0xsequence/wallet-primitives';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../index.js';
import { Chain } from 'viem';
export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export declare const getChain: (chainId: number) => Chain;
export declare class RpcRelayer implements Relayer {
    readonly kind: 'relayer';
    readonly type = "rpc";
    readonly id: string;
    readonly chainId: number;
    private client;
    private fetch;
    private provider;
    private readonly projectAccessKey?;
    constructor(hostname: string, chainId: number, rpcUrl: string, fetchImpl?: Fetch, projectAccessKey?: string);
    isAvailable(_wallet: Address.Address, chainId: number): Promise<boolean>;
    feeTokens(): Promise<{
        isFeeRequired: boolean;
        tokens?: RpcFeeToken[];
        paymentAddress?: Address.Address;
    }>;
    feeOptions(wallet: Address.Address, chainId: number, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    sendMetaTxn(walletAddress: Address.Address, to: Address.Address, data: Hex.Hex, chainId: number, quote?: FeeQuote, preconditions?: TransactionPrecondition[]): Promise<{
        opHash: Hex.Hex;
    }>;
    relay(to: Address.Address, data: Hex.Hex, chainId: number, quote?: FeeQuote, preconditions?: TransactionPrecondition[]): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>;
    checkPrecondition(precondition: TransactionPrecondition): Promise<boolean>;
    private mapRpcFeeTokenToAddress;
}
//# sourceMappingURL=index.d.ts.map
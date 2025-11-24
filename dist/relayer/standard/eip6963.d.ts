import { EIP6963ProviderInfo, EIP6963ProviderDetail } from 'mipd';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../index.js';
import { Address, Hex } from 'ox';
import { Payload } from '@0xsequence/wallet-primitives';
import { FeeToken, TransactionPrecondition } from '../rpc-relayer/relayer.gen.js';
export declare class EIP6963Relayer implements Relayer {
    readonly kind: 'relayer';
    readonly type = "eip6963";
    readonly id: string;
    readonly info: EIP6963ProviderInfo;
    private readonly relayer;
    constructor(detail: EIP6963ProviderDetail);
    isAvailable(wallet: Address.Address, chainId: number): Promise<boolean>;
    feeTokens(): Promise<{
        isFeeRequired: boolean;
        tokens?: FeeToken[];
        paymentAddress?: Address.Address;
    }>;
    feeOptions(wallet: Address.Address, chainId: number, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    relay(to: Address.Address, data: Hex.Hex, chainId: number, _?: FeeQuote): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>;
    checkPrecondition(precondition: TransactionPrecondition): Promise<boolean>;
}
export declare function getEIP6963Store(): import("mipd").Store;
export declare function getRelayers(): EIP6963Relayer[];
//# sourceMappingURL=eip6963.d.ts.map
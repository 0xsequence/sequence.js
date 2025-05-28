import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer.js';
export declare class SequenceRelayer implements Relayer {
    readonly id = "sequence";
    private readonly service;
    constructor(host: string);
    feeOptions(wallet: Address.Address, _chainId: bigint, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    relay(to: Address.Address, data: Hex.Hex, _chainId: bigint, quote?: FeeQuote): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, _chainId: bigint): Promise<OperationStatus>;
}
//# sourceMappingURL=sequence.d.ts.map
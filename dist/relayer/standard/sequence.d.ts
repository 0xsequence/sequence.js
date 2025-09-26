import { IntentPrecondition } from '@0xsequence/relayer';
import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer.js';
export declare class SequenceRelayer implements Relayer {
    readonly kind: 'relayer';
    readonly type = "sequence";
    readonly id = "sequence";
    private readonly service;
    constructor(host: string);
    isAvailable(_wallet: Address.Address, _chainId: number): Promise<boolean>;
    feeOptions(wallet: Address.Address, _chainId: number, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    checkPrecondition(precondition: IntentPrecondition): Promise<boolean>;
    relay(to: Address.Address, data: Hex.Hex, _chainId: number, quote?: FeeQuote): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, _chainId: number): Promise<OperationStatus>;
}
//# sourceMappingURL=sequence.d.ts.map
import { Payload, Precondition } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer.js';
export declare class PkRelayer implements Relayer {
    private readonly provider;
    readonly kind: 'relayer';
    readonly type = "pk";
    readonly id = "pk";
    private readonly relayer;
    constructor(privateKey: Hex.Hex, provider: Provider.Provider);
    isAvailable(_wallet: Address.Address, chainId: bigint): Promise<boolean>;
    feeOptions(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<{
        options: FeeOption[];
        quote?: FeeQuote;
    }>;
    relay(to: Address.Address, data: Hex.Hex, chainId: bigint, _?: FeeQuote): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus>;
    checkPrecondition(precondition: Precondition.Precondition): Promise<boolean>;
}
//# sourceMappingURL=pk-relayer.d.ts.map
import { Payload, Precondition } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../index.js';
import { FeeToken } from '../rpc-relayer/relayer.gen.js';
export declare class PkRelayer implements Relayer {
    private readonly provider;
    readonly kind: 'relayer';
    readonly type = "pk";
    readonly id = "pk";
    private readonly relayer;
    constructor(privateKey: Hex.Hex, provider: Provider.Provider);
    isAvailable(_wallet: Address.Address, chainId: number): Promise<boolean>;
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
    checkPrecondition(precondition: Precondition.Precondition): Promise<boolean>;
}
//# sourceMappingURL=pk-relayer.d.ts.map
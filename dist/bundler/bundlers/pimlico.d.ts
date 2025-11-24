import { Payload } from '@0xsequence/wallet-primitives';
import { Bundler } from '../bundler.js';
import { Provider, Hex, Address } from 'ox';
import { UserOperation } from 'ox/erc4337';
import { Relayer } from '@0xsequence/relayer';
export declare class PimlicoBundler implements Bundler {
    readonly kind: 'bundler';
    readonly id: string;
    readonly provider: Provider.Provider;
    readonly bundlerRpcUrl: string;
    constructor(bundlerRpcUrl: string, provider: Provider.Provider | string);
    isAvailable(entrypoint: Address.Address, chainId: number): Promise<boolean>;
    relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{
        opHash: Hex.Hex;
    }>;
    estimateLimits(wallet: Address.Address, payload: Payload.Calls4337_07): Promise<{
        speed?: 'slow' | 'standard' | 'fast';
        payload: Payload.Calls4337_07;
    }[]>;
    private createEstimateLimitVariation;
    status(opHash: Hex.Hex, _chainId: number): Promise<Relayer.OperationStatus>;
    private bundlerRpc;
}
//# sourceMappingURL=pimlico.d.ts.map
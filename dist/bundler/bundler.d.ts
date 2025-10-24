import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { UserOperation } from 'ox/erc4337';
import { Relayer } from '@0xsequence/relayer';
export interface Bundler {
    kind: 'bundler';
    id: string;
    estimateLimits(wallet: Address.Address, payload: Payload.Calls4337_07): Promise<{
        speed?: 'slow' | 'standard' | 'fast';
        payload: Payload.Calls4337_07;
    }[]>;
    relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{
        opHash: Hex.Hex;
    }>;
    status(opHash: Hex.Hex, chainId: number): Promise<Relayer.OperationStatus>;
    isAvailable(entrypoint: Address.Address, chainId: number): Promise<boolean>;
}
export declare function isBundler(relayer: any): relayer is Bundler;
//# sourceMappingURL=bundler.d.ts.map
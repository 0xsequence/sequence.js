import { Config, Payload } from '@0xsequence/wallet-primitives';
import { Shared } from './manager.js';
import { Address, Hex } from 'ox';
import { RecoverySigner } from './types/signer.js';
import { QueuedRecoveryPayload } from './types/recovery.js';
export declare class Recovery {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    private updateRecoveryModule;
    initRecoveryModule(modules: Config.SapientSignerLeaf[], address: Address.Address): Promise<void>;
    hasRecoveryModule(modules: Config.SapientSignerLeaf[]): boolean;
    addRecoverySignerToModules(modules: Config.SapientSignerLeaf[], address: Address.Address): Promise<void>;
    removeRecoverySignerFromModules(modules: Config.SapientSignerLeaf[], address: Address.Address): Promise<void>;
    addRecoveryMnemonic(wallet: Address.Address, mnemonic: string): Promise<string>;
    addRecoverySigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    removeRecoverySigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    completeRecoveryUpdate(requestId: string): Promise<void>;
    getRecoverySigners(address: Address.Address): Promise<RecoverySigner[] | undefined>;
    queueRecoveryPayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls): Promise<string>;
    completeRecoveryPayload(requestId: string): Promise<{
        to: Address.Address;
        data: Hex.Hex;
    }>;
    getQueuedRecoveryPayloads(wallet?: Address.Address): Promise<QueuedRecoveryPayload[]>;
    onQueuedRecoveryPayloadsUpdate(wallet: Address.Address | undefined, cb: (payloads: QueuedRecoveryPayload[]) => void, trigger?: boolean): () => void;
    updateQueuedRecoveryPayloads(): Promise<void>;
    encodeRecoverySignature(imageHash: Hex.Hex, signer: Address.Address): Promise<import("ox/Bytes").Bytes>;
}
//# sourceMappingURL=recovery.d.ts.map
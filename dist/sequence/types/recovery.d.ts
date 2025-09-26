import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
export type QueuedRecoveryPayload = {
    id: string;
    index: bigint;
    recoveryModule: Address.Address;
    wallet: Address.Address;
    signer: Address.Address;
    chainId: number;
    startTimestamp: bigint;
    endTimestamp: bigint;
    payloadHash: Hex.Hex;
    payload?: Payload.Payload;
};
//# sourceMappingURL=recovery.d.ts.map
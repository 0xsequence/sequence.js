import { Address } from 'ox';
import { Shared } from './manager.js';
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives';
export declare class Guard {
    private readonly shared;
    constructor(shared: Shared);
    sign(wallet: Address.Address, chainId: bigint, payload: Payload.Payload): Promise<SequenceSignature.SignatureOfSignerLeafHash>;
    witness(wallet: Address.Address): Promise<void>;
}
//# sourceMappingURL=guard.d.ts.map
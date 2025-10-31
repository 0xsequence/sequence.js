import { Address, Hex } from 'ox';
import { Shared } from './manager.js';
import { Kind, SignerWithKind, WitnessExtraSignerKind } from './types/signer.js';
export declare function isWitnessExtraSignerKind(extra: any): extra is WitnessExtraSignerKind;
export declare class Signers {
    private readonly shared;
    constructor(shared: Shared);
    kindOf(wallet: Address.Address, address: Address.Address, imageHash?: Hex.Hex): Promise<Kind | undefined>;
    resolveKinds(wallet: Address.Address, signers: (Address.Address | {
        address: Address.Address;
        imageHash: Hex.Hex;
    })[]): Promise<SignerWithKind[]>;
}
//# sourceMappingURL=signers.d.ts.map
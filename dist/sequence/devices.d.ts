import { Signers } from '@0xsequence/wallet-core';
import { Address } from 'ox';
import { Shared } from './manager.js';
export declare class Devices {
    private readonly shared;
    constructor(shared: Shared);
    list(): Promise<`0x${string}`[]>;
    has(address: Address.Address): Promise<boolean>;
    create(): Promise<Signers.Pk.Pk>;
    get(address: Address.Address): Promise<Signers.Pk.Pk | undefined>;
    witness(address: Address.Address, wallet: Address.Address): Promise<void>;
    remove(address: Address.Address): Promise<void>;
}
//# sourceMappingURL=devices.d.ts.map
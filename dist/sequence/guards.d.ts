import { Address } from 'ox';
import { Shared } from './manager.js';
import { Signers } from '@0xsequence/wallet-core';
import { Config } from '@0xsequence/wallet-primitives';
export type GuardRole = 'wallet' | 'sessions';
export declare class Guards {
    private readonly shared;
    constructor(shared: Shared);
    getByRole(role: GuardRole): Signers.Guard;
    getByAddress(address: Address.Address): [GuardRole, Signers.Guard] | undefined;
    topology(role: GuardRole): Config.Topology | undefined;
}
//# sourceMappingURL=guards.d.ts.map
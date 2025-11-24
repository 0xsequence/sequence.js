import { Permission } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
export type ExplicitSessionConfig = {
    valueLimit: bigint;
    deadline: bigint;
    permissions: Permission.Permission[];
    chainId: number;
};
export type ImplicitSession = {
    sessionAddress: Address.Address;
    type: 'implicit';
};
export type ExplicitSession = {
    sessionAddress: Address.Address;
    valueLimit: bigint;
    deadline: bigint;
    permissions: Permission.Permission[];
    chainId: number;
    type: 'explicit';
};
export type Session = {
    type: 'explicit' | 'implicit';
    sessionAddress: Address.Address;
    valueLimit?: bigint;
    deadline?: bigint;
    permissions?: Permission.Permission[];
    chainId?: number;
};
//# sourceMappingURL=types.d.ts.map
import { Address } from 'ox';
export type Extensions = {
    passkeys: Address.Address;
    recovery: Address.Address;
    sessions: Address.Address;
};
export declare const Dev1: Extensions;
export declare const Dev2: Extensions;
export declare const Rc3: Extensions;
export declare const Rc4: Extensions;
export * as Passkeys from './passkeys.js';
export * as Recovery from './recovery.js';
//# sourceMappingURL=index.d.ts.map
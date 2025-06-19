import { Address, Hex } from 'ox';
export type Context = {
    factory: Address.Address;
    stage1: Address.Address;
    stage2: Address.Address;
    creationCode: Hex.Hex;
};
export declare const Dev1: Context;
export declare const Dev2: Context;
//# sourceMappingURL=context.d.ts.map
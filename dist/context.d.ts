import { Address, Hex } from 'ox';
export type Capabilities = {
    erc4337?: {
        entrypoint: Address.Address;
    };
};
export type Context = {
    factory: Address.Address;
    stage1: Address.Address;
    stage2: Address.Address;
    creationCode: Hex.Hex;
    capabilities?: Capabilities;
};
export declare const Dev1: Context;
export declare const Dev2: Context;
export declare const Dev2_4337: Context;
export declare const Rc3: Context;
export declare const Rc3_4337: Context;
export declare const Rc4: Context;
export declare const Rc4_4337: Context;
export type KnownContext = Context & {
    name: string;
    development: boolean;
};
export declare const KnownContexts: KnownContext[];
export declare function isKnownContext(context: Context): context is KnownContext;
//# sourceMappingURL=context.d.ts.map
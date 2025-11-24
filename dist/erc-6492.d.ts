import { Address, Bytes, Hex, Provider } from 'ox';
import { Context } from './context.js';
export declare function deploy<T extends Bytes.Bytes | Hex.Hex>(deployHash: T, context: Context): {
    to: Address.Address;
    data: T;
};
export declare function wrap<T extends Bytes.Bytes | Hex.Hex>(signature: T, { to, data }: {
    to: Address.Address;
    data: Bytes.Bytes | Hex.Hex;
}): T;
export declare function decode<T extends Bytes.Bytes | Hex.Hex>(signature: T): {
    signature: T;
    erc6492?: {
        to: Address.Address;
        data: T;
    };
};
export declare function isValid(address: Address.Address, messageHash: Bytes.Bytes | Hex.Hex, encodedSignature: Bytes.Bytes | Hex.Hex, provider: Provider.Provider): Promise<boolean>;
//# sourceMappingURL=erc-6492.d.ts.map
import { Address, Hex, Bytes } from 'ox';
import * as Client from './client/guard.gen.js';
import * as Types from './types.js';
export declare class Guard implements Types.Guard {
    private readonly privateKey;
    readonly address: Address.Address;
    constructor(privateKey: Hex.Hex);
    signPayload(wallet: Address.Address, chainId: number, type: Client.PayloadType, digest: Bytes.Bytes, message: Bytes.Bytes, signatures?: Client.Signature[]): Promise<{
        r: bigint;
        s: bigint;
        yParity: number;
    }>;
}
//# sourceMappingURL=local.d.ts.map
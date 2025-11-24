import { Address, Bytes } from 'ox';
import * as Client from './client/guard.gen.js';
import * as Types from './types.js';
export declare class Guard implements Types.Guard {
    private readonly guard?;
    readonly address: Address.Address;
    constructor(hostname: string, address: Address.Address, fetch?: Client.Fetch);
    signPayload(wallet: Address.Address, chainId: number, type: Client.PayloadType, digest: Bytes.Bytes, message: Bytes.Bytes, signatures?: Client.Signature[], token?: Client.AuthToken): Promise<{
        r: bigint;
        s: bigint;
        yParity: number;
    }>;
}
//# sourceMappingURL=sequence.d.ts.map
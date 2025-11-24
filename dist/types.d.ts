import { Address, Bytes, Signature } from 'ox';
import * as Client from './client/guard.gen.js';
export interface Guard {
    readonly address: Address.Address;
    signPayload(wallet: Address.Address, chainId: number, type: Client.PayloadType, digest: Bytes.Bytes, message: Bytes.Bytes, signatures?: Client.Signature[], token?: Client.AuthToken): Promise<Signature.Signature>;
}
export declare class AuthRequiredError extends Error {
    readonly id: 'TOTP' | 'PIN';
    constructor(id: 'TOTP' | 'PIN');
}
//# sourceMappingURL=types.d.ts.map
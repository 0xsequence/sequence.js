import { Address } from 'ox';
import { Payload } from '@0xsequence/wallet-primitives';
import * as GuardService from '@0xsequence/guard';
import * as Envelope from '../envelope.js';
type GuardToken = {
    id: 'TOTP' | 'PIN' | 'recovery';
    code: string;
};
export declare class Guard {
    private readonly guard;
    readonly address: Address.Address;
    constructor(guard: GuardService.Guard);
    signEnvelope<T extends Payload.Payload>(envelope: Envelope.Signed<T>, token?: GuardToken): Promise<Envelope.Signature>;
}
export {};
//# sourceMappingURL=guard.d.ts.map
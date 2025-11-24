import { Hex, Bytes } from 'ox';
import { CommitVerifierReturn, CompleteAuthReturn, KeyType, IdentityType, AuthMode } from './identity-instrument.gen.js';
export * as Client from './identity-instrument.gen.js';
import { Challenge } from './challenge.js';
export type { CommitVerifierReturn, CompleteAuthReturn };
export { KeyType, IdentityType, AuthMode };
export * from './challenge.js';
export declare class IdentityInstrument {
    private scope?;
    private rpc;
    constructor(hostname: string, scope?: string, fetch?: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & typeof globalThis.fetch);
    commitVerifier(authKey: AuthKey, challenge: Challenge): Promise<CommitVerifierReturn>;
    completeAuth(authKey: AuthKey, challenge: Challenge): Promise<CompleteAuthReturn>;
    sign(authKey: AuthKey, digest: Bytes.Bytes): Promise<`0x${string}`>;
}
export interface AuthKey {
    signer: string;
    address: string;
    keyType: KeyType;
    sign(digest: Bytes.Bytes): Promise<Hex.Hex>;
}
//# sourceMappingURL=index.d.ts.map
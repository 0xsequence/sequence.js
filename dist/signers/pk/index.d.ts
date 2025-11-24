import type { Payload as PayloadTypes, Signature as SignatureTypes } from '@0xsequence/wallet-primitives';
import { Address, Bytes, Hex, PublicKey } from 'ox';
import { Signer as SignerInterface, Witnessable } from '../index.js';
import { State } from '../../index.js';
export interface PkStore {
    address(): Address.Address;
    publicKey(): PublicKey.PublicKey;
    signDigest(digest: Bytes.Bytes): Promise<{
        r: bigint;
        s: bigint;
        yParity: number;
    }>;
}
export declare class MemoryPkStore implements PkStore {
    private readonly privateKey;
    constructor(privateKey: Hex.Hex);
    address(): Address.Address;
    publicKey(): PublicKey.PublicKey;
    signDigest(digest: Bytes.Bytes): Promise<{
        r: bigint;
        s: bigint;
        yParity: number;
    }>;
}
export declare class Pk implements SignerInterface, Witnessable {
    private readonly privateKey;
    readonly address: Address.Address;
    readonly pubKey: PublicKey.PublicKey;
    constructor(privateKey: Hex.Hex | PkStore);
    sign(wallet: Address.Address, chainId: number, payload: PayloadTypes.Parented): Promise<SignatureTypes.SignatureOfSignerLeaf>;
    signDigest(digest: Bytes.Bytes): Promise<SignatureTypes.SignatureOfSignerLeaf>;
    witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void>;
}
export * as Encrypted from './encrypted.js';
//# sourceMappingURL=index.d.ts.map
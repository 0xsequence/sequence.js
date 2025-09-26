import { Config, Payload, Signature } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
export type Envelope<T extends Payload.Payload> = {
    readonly wallet: Address.Address;
    readonly chainId: number;
    readonly configuration: Config.Config;
    readonly payload: T;
};
export type Signature = {
    address: Address.Address;
    signature: Signature.SignatureOfSignerLeaf;
};
export type SapientSignature = {
    imageHash: Hex.Hex;
    signature: Signature.SignatureOfSapientSignerLeaf;
};
export declare function isSignature(sig: any): sig is Signature;
export declare function isSapientSignature(sig: any): sig is SapientSignature;
export type Signed<T extends Payload.Payload> = Envelope<T> & {
    signatures: (Signature | SapientSignature)[];
};
export declare function signatureForLeaf(envelope: Signed<Payload.Payload>, leaf: Config.Leaf): Signature | SapientSignature | undefined;
export declare function weightOf(envelope: Signed<Payload.Payload>): {
    weight: bigint;
    threshold: bigint;
};
export declare function reachedThreshold(envelope: Signed<Payload.Payload>): boolean;
export declare function encodeSignature(envelope: Signed<Payload.Payload>): Signature.RawSignature;
export declare function toSigned<T extends Payload.Payload>(envelope: Envelope<T>, signatures?: (Signature | SapientSignature)[]): Signed<T>;
export declare function addSignature(envelope: Signed<Payload.Payload>, signature: Signature | SapientSignature, args?: {
    replace?: boolean;
}): void;
export declare function isSigned(envelope: Envelope<Payload.Payload>): envelope is Signed<Payload.Payload>;
//# sourceMappingURL=envelope.d.ts.map
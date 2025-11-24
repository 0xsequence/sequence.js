import { Bytes, Hex } from 'ox';
import * as GenericTree from '../generic-tree.js';
export type PasskeyMetadata = {
    credentialId: string;
};
export type PublicKey = {
    requireUserVerification: boolean;
    x: Hex.Hex;
    y: Hex.Hex;
    metadata?: PasskeyMetadata | Hex.Hex;
};
export declare function metadataTree(metadata: Required<PublicKey>['metadata']): GenericTree.Tree;
export declare function metadataNode(metadata: Required<PublicKey>['metadata']): GenericTree.Node;
export declare function toTree(publicKey: PublicKey): GenericTree.Tree;
export declare function fromTree(tree: GenericTree.Tree): PublicKey;
export declare function rootFor(publicKey: PublicKey): Hex.Hex;
export type DecodedSignature = {
    publicKey: PublicKey;
    r: Bytes.Bytes;
    s: Bytes.Bytes;
    authenticatorData: Bytes.Bytes;
    clientDataJSON: string;
    embedMetadata?: boolean;
};
export declare function encode(decoded: DecodedSignature): Bytes.Bytes;
export declare function isValidSignature(challenge: Hex.Hex, decoded: DecodedSignature): boolean;
export declare function decode(data: Bytes.Bytes): Required<DecodedSignature> & {
    challengeIndex: number;
    typeIndex: number;
};
//# sourceMappingURL=passkeys.d.ts.map
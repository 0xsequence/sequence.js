import { Address, Bytes, Hex } from 'ox';
import { RawConfig, RawTopology, SignatureOfSapientSignerLeaf, SignatureOfSignerLeaf } from './signature.js';
export type SignerLeaf = {
    type: 'signer';
    address: Address.Address;
    weight: bigint;
    signed?: boolean;
    signature?: SignatureOfSignerLeaf;
};
export type SapientSignerLeaf = {
    type: 'sapient-signer';
    address: Address.Address;
    weight: bigint;
    imageHash: Hex.Hex;
    signed?: boolean;
    signature?: SignatureOfSapientSignerLeaf;
};
export type SubdigestLeaf = {
    type: 'subdigest';
    digest: Hex.Hex;
};
export type AnyAddressSubdigestLeaf = {
    type: 'any-address-subdigest';
    digest: Hex.Hex;
};
export type NestedLeaf = {
    type: 'nested';
    tree: Topology;
    weight: bigint;
    threshold: bigint;
};
export type NodeLeaf = Hex.Hex;
export type Node = [Topology, Topology];
export type Leaf = SignerLeaf | SapientSignerLeaf | SubdigestLeaf | AnyAddressSubdigestLeaf | NestedLeaf | NodeLeaf;
export type Topology = Node | Leaf;
export type Config = {
    threshold: bigint;
    checkpoint: bigint;
    topology: Topology;
    checkpointer?: Address.Address;
};
export declare function isSignerLeaf(cand: any): cand is SignerLeaf;
export declare function isSapientSignerLeaf(cand: any): cand is SapientSignerLeaf;
export declare function isSubdigestLeaf(cand: any): cand is SubdigestLeaf;
export declare function isAnyAddressSubdigestLeaf(cand: any): cand is AnyAddressSubdigestLeaf;
export declare function isNodeLeaf(cand: any): cand is NodeLeaf;
export declare function isNestedLeaf(cand: any): cand is NestedLeaf;
export declare function isNode(cand: any): cand is Node;
export declare function isConfig(cand: any): cand is Config;
export declare function isLeaf(cand: Topology): cand is Leaf;
export declare function isTopology(cand: any): cand is Topology;
export declare function getSigners(configuration: Config | Topology): {
    signers: Address.Address[];
    sapientSigners: {
        address: Address.Address;
        imageHash: Hex.Hex;
    }[];
    isComplete: boolean;
};
export declare function findSignerLeaf(configuration: Config | Topology, address: Address.Address): SignerLeaf | SapientSignerLeaf | undefined;
export declare function getWeight(topology: RawTopology | RawConfig | Config, canSign: (signer: SignerLeaf | SapientSignerLeaf) => boolean): {
    weight: bigint;
    maxWeight: bigint;
};
export declare function hashConfiguration(topology: Topology | Config): Bytes.Bytes;
export declare function flatLeavesToTopology(leaves: Leaf[]): Topology;
export declare function configToJson(config: Config): string;
export declare function configFromJson(json: string): Config;
export type SignerSignature<T> = [T] extends [Promise<unknown>] ? never : MaybePromise<T> | {
    signature: Promise<T>;
    onSignerSignature?: SignerSignatureCallback;
    onCancel?: CancelCallback;
};
export declare function normalizeSignerSignature<T>(signature: SignerSignature<T>): {
    signature: Promise<T>;
    onSignerSignature?: SignerSignatureCallback;
    onCancel?: CancelCallback;
};
export type SignerErrorCallback = (signer: SignerLeaf | SapientSignerLeaf, error: unknown) => void;
type SignerSignatureCallback = (topology: RawTopology) => void;
type CancelCallback = (success: boolean) => void;
type MaybePromise<T> = T | Promise<T>;
export declare function mergeTopology(a: Topology, b: Topology): Topology;
export {};
//# sourceMappingURL=config.d.ts.map
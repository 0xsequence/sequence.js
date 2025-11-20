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
export declare function topologyToFlatLeaves(topology: Topology): Leaf[];
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
/**
 * Checks if a wallet topology or config has any values that are too large.
 *
 * Recursively checks:
 * - threshold (max 65535)
 * - checkpoint (max 72057594037927935)
 * - weight (max 255)
 * If any value is too large, or a nested part is invalid, returns true.
 *
 * @param topology - The wallet topology or config to check.
 * @returns True if any value is invalid, otherwise false.
 */
export declare function hasInvalidValues(topology: Topology | Config): boolean;
/**
 * Calculates the maximum depth of a wallet topology tree.
 *
 * The depth is defined as the longest path from the root node to any leaf node.
 *
 * @param topology - The wallet topology to evaluate.
 * @returns The maximum depth of the topology tree.
 */
export declare function maximumDepth(topology: Topology): number;
/**
 * Evaluates the safety of a wallet configuration.
 *
 * This function checks for several potential security issues:
 * 1. Zero threshold - would allow anyone to send transactions
 * 2. Excessive tree depth - could cause issues with contract execution
 * 3. Unreachable threshold - would make it impossible to sign transactions
 * 4. Invalid values - would make it impossible to encode in a signature
 *
 * @param config The wallet configuration to evaluate
 * @throws {Error} With code 'unsafe-threshold-0' if the threshold is zero
 * @throws {Error} With code 'unsafe-depth' if the tree depth exceeds 32
 * @throws {Error} With code 'unsafe-threshold' if the threshold is higher than the maximum possible weight
 * @throws {Error} With code 'unsafe-invalid-values' if the configuration has invalid values
 */
export declare function evaluateConfigurationSafety(config: Config): void;
export declare function replaceAddress(topology: Topology, targetAddress: Address.Address, replacementAddress: Address.Address): Topology;
export {};
//# sourceMappingURL=config.d.ts.map
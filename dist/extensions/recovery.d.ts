import { Address, Bytes, Hex, Provider } from 'ox';
import * as GenericTree from '../generic-tree.js';
import { Signature } from '../index.js';
import * as Payload from '../payload.js';
export declare const FLAG_RECOVERY_LEAF = 1;
export declare const FLAG_NODE = 3;
export declare const FLAG_BRANCH = 4;
export declare const QUEUE_PAYLOAD: {
    readonly name: "queuePayload";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_wallet";
    }, {
        readonly type: "address";
        readonly name: "_signer";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "bool";
            readonly name: "noChainId";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "to";
            }, {
                readonly type: "uint256";
                readonly name: "value";
            }, {
                readonly type: "bytes";
                readonly name: "data";
            }, {
                readonly type: "uint256";
                readonly name: "gasLimit";
            }, {
                readonly type: "bool";
                readonly name: "delegateCall";
            }, {
                readonly type: "bool";
                readonly name: "onlyFallback";
            }, {
                readonly type: "uint256";
                readonly name: "behaviorOnError";
            }];
            readonly name: "calls";
        }, {
            readonly type: "uint256";
            readonly name: "space";
        }, {
            readonly type: "uint256";
            readonly name: "nonce";
        }, {
            readonly type: "bytes";
            readonly name: "message";
        }, {
            readonly type: "bytes32";
            readonly name: "imageHash";
        }, {
            readonly type: "bytes32";
            readonly name: "digest";
        }, {
            readonly type: "address[]";
            readonly name: "parentWallets";
        }];
        readonly name: "_payload";
    }, {
        readonly type: "bytes";
        readonly name: "_signature";
    }];
    readonly outputs: readonly [];
};
export declare const TIMESTAMP_FOR_QUEUED_PAYLOAD: {
    readonly name: "timestampForQueuedPayload";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_wallet";
    }, {
        readonly type: "address";
        readonly name: "_signer";
    }, {
        readonly type: "bytes32";
        readonly name: "_payloadHash";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const QUEUED_PAYLOAD_HASHES: {
    readonly name: "queuedPayloadHashes";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_wallet";
    }, {
        readonly type: "address";
        readonly name: "_signer";
    }, {
        readonly type: "uint256";
        readonly name: "_index";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
};
export declare const TOTAL_QUEUED_PAYLOADS: {
    readonly name: "totalQueuedPayloads";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_wallet";
    }, {
        readonly type: "address";
        readonly name: "_signer";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
/**
 * A leaf in the Recovery tree, storing:
 *  - signer who can queue a payload
 *  - requiredDeltaTime how many seconds must pass since the payload is queued
 *  - minTimestamp a minimal timestamp that must be at or below the queueing time
 */
export type RecoveryLeaf = {
    type: 'leaf';
    signer: Address.Address;
    requiredDeltaTime: bigint;
    minTimestamp: bigint;
};
/**
 * A branch is a list of subtrees (≥2 in length).
 */
export type Branch = [Tree, Tree];
/**
 * The topology of a recovery tree can be either:
 * - A node (pair of subtrees)
 * - A node leaf (32-byte hash)
 * - A recovery leaf (signer with timing constraints)
 */
export type Tree = Branch | GenericTree.Node | RecoveryLeaf;
/**
 * Type guard to check if a value is a RecoveryLeaf
 */
export declare function isRecoveryLeaf(cand: any): cand is RecoveryLeaf;
/**
 * Type guard to check if a value is a Node (pair of subtrees)
 */
export declare function isBranch(cand: any): cand is Branch;
/**
 * Type guard to check if a value is a Topology
 */
export declare function isTree(cand: any): cand is Tree;
/**
 * EIP-712 domain parameters for "Sequence Wallet - Recovery Mode"
 */
export declare const DOMAIN_NAME = "Sequence Wallet - Recovery Mode";
export declare const DOMAIN_VERSION = "1";
/**
 * Recursively computes the root hash of a RecoveryTree,
 * consistent with the contract's fkeccak256 usage for (root, node).
 *
 * For recovery leaves, it hashes the leaf data with a prefix.
 * For node leaves, it returns the hash directly.
 * For nodes, it hashes the concatenation of the hashes of both subtrees.
 */
export declare function hashConfiguration(topology: Tree): Hex.Hex;
/**
 * Flatten a RecoveryTree into an array of just the leaves.
 * Ignores branch boundaries or node references.
 *
 * @returns Object containing:
 * - leaves: Array of RecoveryLeaf nodes
 * - isComplete: boolean indicating if all leaves are present (no node references)
 */
export declare function getRecoveryLeaves(topology: Tree): {
    leaves: RecoveryLeaf[];
    isComplete: boolean;
};
/**
 * Decode a binary encoded topology into a Topology object
 *
 * @param encoded - The binary encoded topology
 * @returns The decoded Topology object
 * @throws Error if the encoding is invalid
 */
export declare function decodeTopology(encoded: Bytes.Bytes): Tree;
/**
 * Parse a branch of the topology from binary encoding
 *
 * @param encoded - The binary encoded branch
 * @returns Object containing:
 * - nodes: Array of parsed Topology nodes
 * - leftover: Any remaining unparsed bytes
 * @throws Error if the encoding is invalid
 */
export declare function parseBranch(encoded: Bytes.Bytes): {
    nodes: Tree[];
    leftover: Bytes.Bytes;
};
/**
 * Trim a topology tree to only include leaves for a specific signer.
 * All other leaves are replaced with their hashes.
 *
 * @param topology - The topology to trim
 * @param signer - The signer address to keep
 * @returns The trimmed topology
 */
export declare function trimTopology(topology: Tree, signer: Address.Address): Tree;
/**
 * Encode a topology into its binary representation
 *
 * @param topology - The topology to encode
 * @returns The binary encoded topology
 * @throws Error if the topology is invalid
 */
export declare function encodeTopology(topology: Tree): Bytes.Bytes;
/**
 * Build a RecoveryTree from an array of leaves, making a minimal branch structure.
 * If there's exactly one leaf, we return that leaf. If there's more than one, we
 * build a branch of them in pairs.
 *
 * @param leaves - Array of recovery leaves
 * @returns A topology tree structure
 * @throws Error if the leaves array is empty
 */
export declare function fromRecoveryLeaves(leaves: RecoveryLeaf[]): Tree;
/**
 * Produces an EIP-712 typed data hash for a "recovery mode" payload,
 * matching the logic in Recovery.sol:
 *
 *   keccak256(
 *     "\x19\x01",
 *     domainSeparator(noChainId, wallet),
 *     Payload.toEIP712(payload)
 *   )
 *
 * @param payload - The payload to hash
 * @param wallet - The wallet address
 * @param chainId - The chain ID
 * @param noChainId - Whether to omit the chain ID from the domain separator
 * @returns The payload hash
 */
export declare function hashRecoveryPayload(payload: Payload.MayRecoveryPayload, wallet: Address.Address, chainId: number, noChainId: boolean): Hex.Hex;
/**
 * Convert a RecoveryTree topology to a generic tree format
 *
 * @param topology - The recovery tree topology to convert
 * @returns A generic tree that produces the same root hash
 */
export declare function toGenericTree(topology: Tree): GenericTree.Tree;
/**
 * Convert a generic tree back to a RecoveryTree topology
 *
 * @param tree - The generic tree to convert
 * @returns A recovery tree topology that produces the same root hash
 */
export declare function fromGenericTree(tree: GenericTree.Tree): Tree;
/**
 * Encodes the calldata for queueing a recovery payload on the recovery extension
 *
 * @param wallet - The wallet address that owns the recovery configuration
 * @param payload - The recovery payload to queue for execution
 * @param signer - The recovery signer address that is queueing the payload
 * @param signature - The signature from the recovery signer authorizing the payload
 * @returns The encoded calldata for the queuePayload function on the recovery extension
 */
export declare function encodeCalldata(wallet: Address.Address, payload: Payload.Recovery<any>, signer: Address.Address, signature: Signature.SignatureOfSignerLeaf): `0x${string}`;
/**
 * Gets the total number of payloads queued by a recovery signer for a wallet
 *
 * @param provider - The provider to use for making the eth_call
 * @param extension - The address of the recovery extension contract
 * @param wallet - The wallet address to check queued payloads for
 * @param signer - The recovery signer address to check queued payloads for
 * @returns The total number of payloads queued by this signer for this wallet
 */
export declare function totalQueuedPayloads(provider: Provider.Provider, extension: Address.Address, wallet: Address.Address, signer: Address.Address): Promise<bigint>;
/**
 * Gets the hash of a queued payload at a specific index
 *
 * @param provider - The provider to use for making the eth_call
 * @param extension - The address of the recovery extension contract
 * @param wallet - The wallet address to get the queued payload for
 * @param signer - The recovery signer address that queued the payload
 * @param index - The index of the queued payload to get the hash for
 * @returns The hash of the queued payload at the specified index
 */
export declare function queuedPayloadHashOf(provider: Provider.Provider, extension: Address.Address, wallet: Address.Address, signer: Address.Address, index: bigint): Promise<Hex.Hex>;
/**
 * Gets the timestamp when a specific payload was queued
 *
 * @param provider - The provider to use for making the eth_call
 * @param extension - The address of the recovery extension contract
 * @param wallet - The wallet address the payload was queued for
 * @param signer - The recovery signer address that queued the payload
 * @param payloadHash - The hash of the queued payload to get the timestamp for
 * @returns The timestamp when the payload was queued, or 0 if not found
 */
export declare function timestampForQueuedPayload(provider: Provider.Provider, extension: Address.Address, wallet: Address.Address, signer: Address.Address, payloadHash: Hex.Hex): Promise<bigint>;
//# sourceMappingURL=recovery.d.ts.map
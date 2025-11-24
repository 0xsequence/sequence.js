import { Abi, AbiFunction, Address, Bytes, Hex } from 'ox';
import * as GenericTree from '../generic-tree.js';
import * as Payload from '../payload.js';
import { packRSY } from '../utils.js';
export const FLAG_RECOVERY_LEAF = 1;
export const FLAG_NODE = 3;
export const FLAG_BRANCH = 4;
const RECOVERY_LEAF_PREFIX = Bytes.fromString('Sequence recovery leaf:\n');
export const QUEUE_PAYLOAD = Abi.from([
    'function queuePayload(address _wallet, address _signer, (uint8 kind,bool noChainId,(address to,uint256 value,bytes data,uint256 gasLimit,bool delegateCall,bool onlyFallback,uint256 behaviorOnError)[] calls,uint256 space,uint256 nonce,bytes message,bytes32 imageHash,bytes32 digest,address[] parentWallets) calldata _payload, bytes calldata _signature) external',
])[0];
export const TIMESTAMP_FOR_QUEUED_PAYLOAD = Abi.from([
    'function timestampForQueuedPayload(address _wallet, address _signer, bytes32 _payloadHash) external view returns (uint256)',
])[0];
export const QUEUED_PAYLOAD_HASHES = Abi.from([
    'function queuedPayloadHashes(address _wallet, address _signer, uint256 _index) external view returns (bytes32)',
])[0];
export const TOTAL_QUEUED_PAYLOADS = Abi.from([
    'function totalQueuedPayloads(address _wallet, address _signer) external view returns (uint256)',
])[0];
/**
 * Type guard to check if a value is a RecoveryLeaf
 */
export function isRecoveryLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'leaf';
}
/**
 * Type guard to check if a value is a Node (pair of subtrees)
 */
export function isBranch(cand) {
    return Array.isArray(cand) && cand.length === 2 && isTree(cand[0]) && isTree(cand[1]);
}
/**
 * Type guard to check if a value is a Topology
 */
export function isTree(cand) {
    return isRecoveryLeaf(cand) || GenericTree.isNode(cand) || isBranch(cand);
}
/**
 * EIP-712 domain parameters for "Sequence Wallet - Recovery Mode"
 */
export const DOMAIN_NAME = 'Sequence Wallet - Recovery Mode';
export const DOMAIN_VERSION = '1';
/**
 * Recursively computes the root hash of a RecoveryTree,
 * consistent with the contract's fkeccak256 usage for (root, node).
 *
 * For recovery leaves, it hashes the leaf data with a prefix.
 * For node leaves, it returns the hash directly.
 * For nodes, it hashes the concatenation of the hashes of both subtrees.
 */
export function hashConfiguration(topology) {
    return GenericTree.hash(toGenericTree(topology));
}
/**
 * Flatten a RecoveryTree into an array of just the leaves.
 * Ignores branch boundaries or node references.
 *
 * @returns Object containing:
 * - leaves: Array of RecoveryLeaf nodes
 * - isComplete: boolean indicating if all leaves are present (no node references)
 */
export function getRecoveryLeaves(topology) {
    const isComplete = true;
    if (isRecoveryLeaf(topology)) {
        return { leaves: [topology], isComplete };
    }
    else if (GenericTree.isNode(topology)) {
        return { leaves: [], isComplete: false };
    }
    else if (isBranch(topology)) {
        const left = getRecoveryLeaves(topology[0]);
        const right = getRecoveryLeaves(topology[1]);
        return { leaves: [...left.leaves, ...right.leaves], isComplete: left.isComplete && right.isComplete };
    }
    else {
        throw new Error('Invalid topology');
    }
}
/**
 * Decode a binary encoded topology into a Topology object
 *
 * @param encoded - The binary encoded topology
 * @returns The decoded Topology object
 * @throws Error if the encoding is invalid
 */
export function decodeTopology(encoded) {
    const { nodes, leftover } = parseBranch(encoded);
    if (leftover.length > 0) {
        throw new Error('Leftover bytes in branch');
    }
    return foldNodes(nodes);
}
/**
 * Parse a branch of the topology from binary encoding
 *
 * @param encoded - The binary encoded branch
 * @returns Object containing:
 * - nodes: Array of parsed Topology nodes
 * - leftover: Any remaining unparsed bytes
 * @throws Error if the encoding is invalid
 */
export function parseBranch(encoded) {
    if (encoded.length === 0) {
        throw new Error('Empty branch');
    }
    const nodes = [];
    let index = 0;
    while (index < encoded.length) {
        const flag = encoded[index];
        if (flag === FLAG_RECOVERY_LEAF) {
            if (encoded.length < index + 32) {
                throw new Error('Invalid recovery leaf');
            }
            const signer = Address.from(Hex.fromBytes(encoded.slice(index + 1, index + 21)));
            const requiredDeltaTime = Bytes.toBigInt(encoded.slice(index + 21, index + 24));
            const minTimestamp = Bytes.toBigInt(encoded.slice(index + 24, index + 32));
            nodes.push({ type: 'leaf', signer, requiredDeltaTime, minTimestamp });
            index += 32;
            continue;
        }
        else if (flag === FLAG_NODE) {
            // total = 1 (flag) + 32 (node hash)
            if (encoded.length < index + 33) {
                throw new Error('Invalid node');
            }
            const node = Hex.fromBytes(encoded.slice(index + 1, index + 33));
            nodes.push(node);
            index += 33;
            continue;
        }
        else if (flag === FLAG_BRANCH) {
            if (encoded.length < index + 4) {
                throw new Error('Invalid branch');
            }
            const size = Bytes.toNumber(encoded.slice(index + 1, index + 4));
            if (encoded.length < index + 4 + size) {
                throw new Error('Invalid branch');
            }
            const branch = encoded.slice(index + 4, index + 4 + size);
            const { nodes: subNodes, leftover } = parseBranch(branch);
            if (leftover.length > 0) {
                throw new Error('Leftover bytes in sub-branch');
            }
            const subTree = foldNodes(subNodes);
            nodes.push(subTree);
            index += 4 + size;
            continue;
        }
        else {
            throw new Error('Invalid flag');
        }
    }
    return { nodes, leftover: encoded.slice(index) };
}
/**
 * Trim a topology tree to only include leaves for a specific signer.
 * All other leaves are replaced with their hashes.
 *
 * @param topology - The topology to trim
 * @param signer - The signer address to keep
 * @returns The trimmed topology
 */
export function trimTopology(topology, signer) {
    if (isRecoveryLeaf(topology)) {
        if (topology.signer === signer) {
            return topology;
        }
        else {
            return hashConfiguration(topology);
        }
    }
    if (GenericTree.isNode(topology)) {
        return topology;
    }
    if (isBranch(topology)) {
        const left = trimTopology(topology[0], signer);
        const right = trimTopology(topology[1], signer);
        // If both are hashes, we can just return the hash of the node
        if (GenericTree.isNode(left) && GenericTree.isNode(right)) {
            return hashConfiguration(topology);
        }
        return [left, right];
    }
    throw new Error('Invalid topology');
}
/**
 * Encode a topology into its binary representation
 *
 * @param topology - The topology to encode
 * @returns The binary encoded topology
 * @throws Error if the topology is invalid
 */
export function encodeTopology(topology) {
    if (isBranch(topology)) {
        const encoded0 = encodeTopology(topology[0]);
        const encoded1 = encodeTopology(topology[1]);
        const isBranching = isBranch(topology[1]);
        if (isBranching) {
            // max 3 bytes for the size
            if (encoded1.length > 16777215) {
                throw new Error('Branch too large');
            }
            const flag = Bytes.fromNumber(FLAG_BRANCH);
            const size = Bytes.padLeft(Bytes.fromNumber(encoded1.length), 3);
            return Bytes.concat(encoded0, flag, size, encoded1);
        }
        else {
            return Bytes.concat(encoded0, encoded1);
        }
    }
    if (GenericTree.isNode(topology)) {
        const flag = Bytes.fromNumber(FLAG_NODE);
        const nodeHash = Bytes.fromHex(topology, { size: 32 });
        return Bytes.concat(flag, nodeHash);
    }
    if (isRecoveryLeaf(topology)) {
        const flag = Bytes.fromNumber(FLAG_RECOVERY_LEAF);
        const signer = Bytes.fromHex(topology.signer, { size: 20 });
        if (topology.requiredDeltaTime > 16777215n) {
            throw new Error('Required delta time too large');
        }
        const requiredDeltaTime = Bytes.padLeft(Bytes.fromNumber(topology.requiredDeltaTime), 3);
        if (topology.minTimestamp > 18446744073709551615n) {
            throw new Error('Min timestamp too large');
        }
        const minTimestamp = Bytes.padLeft(Bytes.fromNumber(topology.minTimestamp), 8);
        return Bytes.concat(flag, signer, requiredDeltaTime, minTimestamp);
    }
    throw new Error('Invalid topology');
}
/**
 * Helper function to fold a list of nodes into a binary tree structure
 *
 * @param nodes - Array of topology nodes
 * @returns A binary tree structure
 * @throws Error if the nodes array is empty
 */
function foldNodes(nodes) {
    if (nodes.length === 0) {
        throw new Error('Empty signature tree');
    }
    if (nodes.length === 1) {
        return nodes[0];
    }
    let tree = nodes[0];
    for (let i = 1; i < nodes.length; i++) {
        tree = [tree, nodes[i]];
    }
    return tree;
}
/**
 * Build a RecoveryTree from an array of leaves, making a minimal branch structure.
 * If there's exactly one leaf, we return that leaf. If there's more than one, we
 * build a branch of them in pairs.
 *
 * @param leaves - Array of recovery leaves
 * @returns A topology tree structure
 * @throws Error if the leaves array is empty
 */
export function fromRecoveryLeaves(leaves) {
    if (leaves.length === 0) {
        throw new Error('Cannot build a tree with zero leaves');
    }
    if (leaves.length === 1) {
        return leaves[0];
    }
    const mid = Math.floor(leaves.length / 2);
    const left = fromRecoveryLeaves(leaves.slice(0, mid));
    const right = fromRecoveryLeaves(leaves.slice(mid));
    return [left, right];
}
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
export function hashRecoveryPayload(payload, wallet, chainId, noChainId) {
    const recoveryPayload = Payload.toRecovery(payload);
    return Hex.fromBytes(Payload.hash(wallet, noChainId ? 0 : chainId, recoveryPayload));
}
/**
 * Convert a RecoveryTree topology to a generic tree format
 *
 * @param topology - The recovery tree topology to convert
 * @returns A generic tree that produces the same root hash
 */
export function toGenericTree(topology) {
    if (isRecoveryLeaf(topology)) {
        // Convert recovery leaf to generic leaf
        return {
            type: 'leaf',
            value: Bytes.concat(RECOVERY_LEAF_PREFIX, Bytes.fromHex(topology.signer, { size: 20 }), Bytes.padLeft(Bytes.fromNumber(topology.requiredDeltaTime), 32), Bytes.padLeft(Bytes.fromNumber(topology.minTimestamp), 32)),
        };
    }
    else if (GenericTree.isNode(topology)) {
        // Node leaves are already in the correct format
        return topology;
    }
    else if (isBranch(topology)) {
        // Convert node to branch
        return [toGenericTree(topology[0]), toGenericTree(topology[1])];
    }
    else {
        throw new Error('Invalid topology');
    }
}
/**
 * Convert a generic tree back to a RecoveryTree topology
 *
 * @param tree - The generic tree to convert
 * @returns A recovery tree topology that produces the same root hash
 */
export function fromGenericTree(tree) {
    if (GenericTree.isLeaf(tree)) {
        // Convert generic leaf back to recovery leaf
        const bytes = tree.value;
        if (bytes.length !== RECOVERY_LEAF_PREFIX.length + 84 ||
            !Bytes.isEqual(bytes.slice(0, RECOVERY_LEAF_PREFIX.length), RECOVERY_LEAF_PREFIX)) {
            throw new Error('Invalid recovery leaf format');
        }
        const offset = RECOVERY_LEAF_PREFIX.length;
        const signer = Address.from(Hex.fromBytes(bytes.slice(offset, offset + 20)));
        const requiredDeltaTime = Bytes.toBigInt(bytes.slice(offset + 20, offset + 52));
        const minTimestamp = Bytes.toBigInt(bytes.slice(offset + 52, offset + 84));
        return {
            type: 'leaf',
            signer,
            requiredDeltaTime,
            minTimestamp,
        };
    }
    else if (GenericTree.isNode(tree)) {
        // Nodes are already in the correct format
        return tree;
    }
    else if (GenericTree.isBranch(tree)) {
        // Convert branch back to node
        if (tree.length !== 2) {
            throw new Error('Recovery tree only supports binary branches');
        }
        return [fromGenericTree(tree[0]), fromGenericTree(tree[1])];
    }
    else {
        throw new Error('Invalid tree format');
    }
}
/**
 * Encodes the calldata for queueing a recovery payload on the recovery extension
 *
 * @param wallet - The wallet address that owns the recovery configuration
 * @param payload - The recovery payload to queue for execution
 * @param signer - The recovery signer address that is queueing the payload
 * @param signature - The signature from the recovery signer authorizing the payload
 * @returns The encoded calldata for the queuePayload function on the recovery extension
 */
export function encodeCalldata(wallet, payload, signer, signature) {
    let signatureBytes;
    if (signature.type === 'erc1271') {
        signatureBytes = signature.data;
    }
    else {
        signatureBytes = Bytes.toHex(packRSY(signature));
    }
    const abiPayload = Payload.toAbiFormat(payload);
    return AbiFunction.encodeData(QUEUE_PAYLOAD, [wallet, signer, abiPayload, signatureBytes]);
}
/**
 * Gets the total number of payloads queued by a recovery signer for a wallet
 *
 * @param provider - The provider to use for making the eth_call
 * @param extension - The address of the recovery extension contract
 * @param wallet - The wallet address to check queued payloads for
 * @param signer - The recovery signer address to check queued payloads for
 * @returns The total number of payloads queued by this signer for this wallet
 */
export async function totalQueuedPayloads(provider, extension, wallet, signer) {
    const total = await provider.request({
        method: 'eth_call',
        params: [
            {
                to: extension,
                data: AbiFunction.encodeData(TOTAL_QUEUED_PAYLOADS, [wallet, signer]),
            },
            'latest',
        ],
    });
    if (total === '0x') {
        return 0n;
    }
    return Hex.toBigInt(total);
}
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
export async function queuedPayloadHashOf(provider, extension, wallet, signer, index) {
    const hash = await provider.request({
        method: 'eth_call',
        params: [
            {
                to: extension,
                data: AbiFunction.encodeData(QUEUED_PAYLOAD_HASHES, [wallet, signer, index]),
            },
            'latest',
        ],
    });
    return hash;
}
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
export async function timestampForQueuedPayload(provider, extension, wallet, signer, payloadHash) {
    const timestamp = await provider.request({
        method: 'eth_call',
        params: [
            {
                to: extension,
                data: AbiFunction.encodeData(TIMESTAMP_FOR_QUEUED_PAYLOAD, [wallet, signer, payloadHash]),
            },
            'latest',
        ],
    });
    return Hex.toBigInt(timestamp);
}
//# sourceMappingURL=recovery.js.map
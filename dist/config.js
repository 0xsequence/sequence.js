import { Address, Bytes, Hash, Hex } from 'ox';
import { isRawConfig, isRawNestedLeaf, isRawSignerLeaf, isSignedSapientSignerLeaf, isSignedSignerLeaf, } from './signature.js';
import { Constants } from './index.js';
export function isSignerLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'signer';
}
export function isSapientSignerLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'sapient-signer';
}
export function isSubdigestLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'subdigest';
}
export function isAnyAddressSubdigestLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'any-address-subdigest';
}
export function isNodeLeaf(cand) {
    return Hex.validate(cand) && cand.length === 66;
}
export function isNestedLeaf(cand) {
    return typeof cand === 'object' && cand !== null && cand.type === 'nested';
}
export function isNode(cand) {
    return Array.isArray(cand) && cand.length === 2 && isTopology(cand[0]) && isTopology(cand[1]);
}
export function isConfig(cand) {
    return typeof cand === 'object' && 'threshold' in cand && 'checkpoint' in cand && 'topology' in cand;
}
export function isLeaf(cand) {
    return (isSignerLeaf(cand) ||
        isSapientSignerLeaf(cand) ||
        isSubdigestLeaf(cand) ||
        isAnyAddressSubdigestLeaf(cand) ||
        isNodeLeaf(cand) ||
        isNestedLeaf(cand));
}
export function isTopology(cand) {
    return isNode(cand) || isLeaf(cand);
}
export function getSigners(configuration) {
    const signers = new Set();
    const sapientSigners = new Set();
    let isComplete = true;
    const scan = (topology) => {
        if (isNode(topology)) {
            scan(topology[0]);
            scan(topology[1]);
        }
        else if (isSignerLeaf(topology)) {
            if (topology.weight) {
                signers.add(topology.address);
            }
        }
        else if (isSapientSignerLeaf(topology)) {
            sapientSigners.add({ address: topology.address, imageHash: topology.imageHash });
        }
        else if (isNodeLeaf(topology)) {
            isComplete = false;
        }
        else if (isNestedLeaf(topology)) {
            if (topology.weight) {
                scan(topology.tree);
            }
        }
    };
    scan(isConfig(configuration) ? configuration.topology : configuration);
    return { signers: Array.from(signers), sapientSigners: Array.from(sapientSigners), isComplete };
}
export function findSignerLeaf(configuration, address) {
    if (isConfig(configuration)) {
        return findSignerLeaf(configuration.topology, address);
    }
    else if (isNode(configuration)) {
        return findSignerLeaf(configuration[0], address) || findSignerLeaf(configuration[1], address);
    }
    else if (isSignerLeaf(configuration)) {
        if (Address.isEqual(configuration.address, address)) {
            return configuration;
        }
    }
    else if (isSapientSignerLeaf(configuration)) {
        if (Address.isEqual(configuration.address, address)) {
            return configuration;
        }
    }
    else if (isNestedLeaf(configuration)) {
        return findSignerLeaf(configuration.tree, address);
    }
    return undefined;
}
export function getWeight(topology, canSign) {
    topology = isRawConfig(topology) || isConfig(topology) ? topology.topology : topology;
    if (isSignedSignerLeaf(topology)) {
        return { weight: topology.weight, maxWeight: topology.weight };
    }
    else if (isSignerLeaf(topology)) {
        return { weight: 0n, maxWeight: canSign(topology) ? topology.weight : 0n };
    }
    else if (isRawSignerLeaf(topology)) {
        return { weight: topology.weight, maxWeight: topology.weight };
    }
    else if (isSignedSapientSignerLeaf(topology)) {
        return { weight: topology.weight, maxWeight: topology.weight };
    }
    else if (isSapientSignerLeaf(topology)) {
        return { weight: 0n, maxWeight: canSign(topology) ? topology.weight : 0n };
    }
    else if (isSubdigestLeaf(topology)) {
        return { weight: 0n, maxWeight: 0n };
    }
    else if (isAnyAddressSubdigestLeaf(topology)) {
        return { weight: 0n, maxWeight: 0n };
    }
    else if (isRawNestedLeaf(topology)) {
        const { weight, maxWeight } = getWeight(topology.tree, canSign);
        return {
            weight: weight >= topology.threshold ? topology.weight : 0n,
            maxWeight: maxWeight >= topology.threshold ? topology.weight : 0n,
        };
    }
    else if (isNodeLeaf(topology)) {
        return { weight: 0n, maxWeight: 0n };
    }
    else {
        const [left, right] = [getWeight(topology[0], canSign), getWeight(topology[1], canSign)];
        return { weight: left.weight + right.weight, maxWeight: left.maxWeight + right.maxWeight };
    }
}
export function hashConfiguration(topology) {
    if (isConfig(topology)) {
        let root = hashConfiguration(topology.topology);
        root = Hash.keccak256(Bytes.concat(root, Bytes.padLeft(Bytes.fromNumber(topology.threshold), 32)));
        root = Hash.keccak256(Bytes.concat(root, Bytes.padLeft(Bytes.fromNumber(topology.checkpoint), 32)));
        root = Hash.keccak256(Bytes.concat(root, Bytes.padLeft(Bytes.fromHex(topology.checkpointer ?? Constants.ZeroAddress), 32)));
        return root;
    }
    if (isSignerLeaf(topology)) {
        return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence signer:\n'), Bytes.fromHex(topology.address), Bytes.padLeft(Bytes.fromNumber(topology.weight), 32)));
    }
    if (isSapientSignerLeaf(topology)) {
        return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence sapient config:\n'), Bytes.fromHex(topology.address), Bytes.padLeft(Bytes.fromNumber(topology.weight), 32), Bytes.padLeft(Bytes.fromHex(topology.imageHash), 32)));
    }
    if (isSubdigestLeaf(topology)) {
        return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence static digest:\n'), Bytes.fromHex(topology.digest)));
    }
    if (isAnyAddressSubdigestLeaf(topology)) {
        return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence any address subdigest:\n'), Bytes.fromHex(topology.digest)));
    }
    if (isNodeLeaf(topology)) {
        return Bytes.fromHex(topology);
    }
    if (isNestedLeaf(topology)) {
        return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence nested config:\n'), hashConfiguration(topology.tree), Bytes.padLeft(Bytes.fromNumber(topology.threshold), 32), Bytes.padLeft(Bytes.fromNumber(topology.weight), 32)));
    }
    if (isNode(topology)) {
        return Hash.keccak256(Bytes.concat(hashConfiguration(topology[0]), hashConfiguration(topology[1])));
    }
    throw new Error('Invalid topology');
}
export function flatLeavesToTopology(leaves) {
    if (leaves.length === 0) {
        throw new Error('Cannot create topology from empty leaves');
    }
    if (leaves.length === 1) {
        return leaves[0];
    }
    if (leaves.length === 2) {
        return [leaves[0], leaves[1]];
    }
    return [
        flatLeavesToTopology(leaves.slice(0, leaves.length / 2)),
        flatLeavesToTopology(leaves.slice(leaves.length / 2)),
    ];
}
export function topologyToFlatLeaves(topology) {
    if (isNode(topology)) {
        return [...topologyToFlatLeaves(topology[0]), ...topologyToFlatLeaves(topology[1])];
    }
    if (isNestedLeaf(topology)) {
        return [...topologyToFlatLeaves(topology.tree)];
    }
    return [topology];
}
export function configToJson(config) {
    return JSON.stringify({
        threshold: config.threshold.toString(),
        checkpoint: config.checkpoint.toString(),
        topology: encodeTopology(config.topology),
        checkpointer: config.checkpointer,
    });
}
export function configFromJson(json) {
    const parsed = JSON.parse(json);
    return {
        threshold: BigInt(parsed.threshold),
        checkpoint: BigInt(parsed.checkpoint),
        checkpointer: parsed.checkpointer,
        topology: decodeTopology(parsed.topology),
    };
}
function encodeTopology(top) {
    if (isNode(top)) {
        return [encodeTopology(top[0]), encodeTopology(top[1])];
    }
    else if (isSignerLeaf(top)) {
        return {
            type: 'signer',
            address: top.address,
            weight: top.weight.toString(),
        };
    }
    else if (isSapientSignerLeaf(top)) {
        return {
            type: 'sapient-signer',
            address: top.address,
            weight: top.weight.toString(),
            imageHash: top.imageHash,
        };
    }
    else if (isSubdigestLeaf(top)) {
        return {
            type: 'subdigest',
            digest: top.digest,
        };
    }
    else if (isAnyAddressSubdigestLeaf(top)) {
        return {
            type: 'any-address-subdigest',
            digest: top.digest,
        };
    }
    else if (isNodeLeaf(top)) {
        return top;
    }
    else if (isNestedLeaf(top)) {
        return {
            type: 'nested',
            tree: encodeTopology(top.tree),
            weight: top.weight.toString(),
            threshold: top.threshold.toString(),
        };
    }
    throw new Error('Invalid topology');
}
function decodeTopology(obj) {
    if (Array.isArray(obj)) {
        if (obj.length !== 2) {
            throw new Error('Invalid node structure in JSON');
        }
        return [decodeTopology(obj[0]), decodeTopology(obj[1])];
    }
    if (typeof obj === 'string') {
        return obj;
    }
    switch (obj.type) {
        case 'signer':
            return {
                type: 'signer',
                address: obj.address,
                weight: BigInt(obj.weight),
            };
        case 'sapient-signer':
            return {
                type: 'sapient-signer',
                address: obj.address,
                weight: BigInt(obj.weight),
                imageHash: obj.imageHash,
            };
        case 'subdigest':
            return {
                type: 'subdigest',
                digest: obj.digest,
            };
        case 'any-address-subdigest':
            return {
                type: 'any-address-subdigest',
                digest: obj.digest,
            };
        case 'nested':
            return {
                type: 'nested',
                tree: decodeTopology(obj.tree),
                weight: BigInt(obj.weight),
                threshold: BigInt(obj.threshold),
            };
        default:
            throw new Error('Invalid type in topology JSON');
    }
}
export function normalizeSignerSignature(signature) {
    if (signature instanceof Promise) {
        return { signature };
    }
    else if (typeof signature === 'object' &&
        signature &&
        'signature' in signature &&
        signature.signature instanceof Promise) {
        return signature;
    }
    else {
        return { signature: Promise.resolve(signature) };
    }
}
export function mergeTopology(a, b) {
    if (isNode(a) && isNode(b)) {
        return [mergeTopology(a[0], b[0]), mergeTopology(a[1], b[1])];
    }
    if (isNode(a) && !isNode(b)) {
        if (!isNodeLeaf(b)) {
            throw new Error('Topology mismatch: cannot merge node with non-node that is not a node leaf');
        }
        const hb = hashConfiguration(b);
        if (!Bytes.isEqual(hb, hashConfiguration(a))) {
            throw new Error('Topology mismatch: node hash does not match');
        }
        return a;
    }
    if (!isNode(a) && isNode(b)) {
        if (!isNodeLeaf(a)) {
            throw new Error('Topology mismatch: cannot merge node with non-node that is not a node leaf');
        }
        const ha = hashConfiguration(a);
        if (!Bytes.isEqual(ha, hashConfiguration(b))) {
            throw new Error('Topology mismatch: node hash does not match');
        }
        return b;
    }
    return mergeLeaf(a, b);
}
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
export function hasInvalidValues(topology) {
    if (isConfig(topology)) {
        return (topology.threshold > 65535n || topology.checkpoint > 72057594037927935n || hasInvalidValues(topology.topology));
    }
    if (isNode(topology)) {
        return hasInvalidValues(topology[0]) || hasInvalidValues(topology[1]);
    }
    if (isNestedLeaf(topology)) {
        return hasInvalidValues(topology.tree) || topology.weight > 255n || topology.threshold > 65535n;
    }
    if (isSignerLeaf(topology) || isSapientSignerLeaf(topology)) {
        return topology.weight > 255n;
    }
    return false;
}
/**
 * Calculates the maximum depth of a wallet topology tree.
 *
 * The depth is defined as the longest path from the root node to any leaf node.
 *
 * @param topology - The wallet topology to evaluate.
 * @returns The maximum depth of the topology tree.
 */
export function maximumDepth(topology) {
    if (isNode(topology)) {
        return Math.max(maximumDepth(topology[0]), maximumDepth(topology[1])) + 1;
    }
    if (isNestedLeaf(topology)) {
        return maximumDepth(topology.tree) + 1;
    }
    return 0;
}
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
export function evaluateConfigurationSafety(config) {
    // If the configuration has a threshold of zero then anyone
    // and send a transaction on the wallet
    if (config.threshold === 0n) {
        throw new Error('unsafe-threshold-0');
    }
    // The configuration may have invalid values, that are not possible
    // to encode in a signature
    if (hasInvalidValues(config)) {
        throw new Error('unsafe-invalid-values');
    }
    // The contracts can safely handle trees up to a depth of 54
    // but we use 32 as a maximum depth to leave some safety margning
    // as 32 should be more than enough for all use cases
    if (maximumDepth(config.topology) > 32) {
        throw new Error('unsafe-depth');
    }
    // The threshold must be reachable, otherwise it would be
    // impossible to sign any signatures using this configuration
    const { maxWeight } = getWeight(config.topology, () => true);
    if (maxWeight < config.threshold) {
        throw new Error('unsafe-threshold');
    }
}
function mergeLeaf(a, b) {
    if (isNodeLeaf(a) && isNodeLeaf(b)) {
        if (!Hex.isEqual(a, b)) {
            throw new Error('Topology mismatch: different node leaves');
        }
        return a;
    }
    if (isNodeLeaf(a) && !isNodeLeaf(b)) {
        const hb = hashConfiguration(b);
        if (!Bytes.isEqual(hb, Bytes.fromHex(a))) {
            throw new Error('Topology mismatch: node leaf hash does not match');
        }
        return b;
    }
    if (!isNodeLeaf(a) && isNodeLeaf(b)) {
        const ha = hashConfiguration(a);
        if (!Bytes.isEqual(ha, Bytes.fromHex(b))) {
            throw new Error('Topology mismatch: node leaf hash does not match');
        }
        return a;
    }
    if (isSignerLeaf(a) && isSignerLeaf(b)) {
        if (a.address !== b.address || a.weight !== b.weight) {
            throw new Error('Topology mismatch: signer fields differ');
        }
        if (!!a.signed !== !!b.signed || !!a.signature !== !!b.signature) {
            throw new Error('Topology mismatch: signer signature fields differ');
        }
        return a;
    }
    if (isSapientSignerLeaf(a) && isSapientSignerLeaf(b)) {
        if (a.address !== b.address || a.weight !== b.weight || a.imageHash !== b.imageHash) {
            throw new Error('Topology mismatch: sapient signer fields differ');
        }
        if (!!a.signed !== !!b.signed || !!a.signature !== !!b.signature) {
            throw new Error('Topology mismatch: sapient signature fields differ');
        }
        return a;
    }
    if (isSubdigestLeaf(a) && isSubdigestLeaf(b)) {
        if (!Bytes.isEqual(Bytes.fromHex(a.digest), Bytes.fromHex(b.digest))) {
            throw new Error('Topology mismatch: subdigest fields differ');
        }
        return a;
    }
    if (isAnyAddressSubdigestLeaf(a) && isAnyAddressSubdigestLeaf(b)) {
        if (!Bytes.isEqual(Bytes.fromHex(a.digest), Bytes.fromHex(b.digest))) {
            throw new Error('Topology mismatch: any-address-subdigest fields differ');
        }
        return a;
    }
    if (isNestedLeaf(a) && isNestedLeaf(b)) {
        if (a.weight !== b.weight || a.threshold !== b.threshold) {
            throw new Error('Topology mismatch: nested leaf fields differ');
        }
        const mergedTree = mergeTopology(a.tree, b.tree);
        return {
            type: 'nested',
            weight: a.weight,
            threshold: a.threshold,
            tree: mergedTree,
        };
    }
    throw new Error('Topology mismatch: incompatible leaf types');
}
export function replaceAddress(topology, targetAddress, replacementAddress) {
    // 1. Handle Branches/Nodes (Recursion)
    if (isNode(topology)) {
        return [
            replaceAddress(topology[0], targetAddress, replacementAddress),
            replaceAddress(topology[1], targetAddress, replacementAddress),
        ];
    }
    // 2. Handle Nested Leaves (Recursion)
    if (isNestedLeaf(topology)) {
        return {
            ...topology,
            tree: replaceAddress(topology.tree, targetAddress, replacementAddress),
        };
    }
    // 3. Handle Leaves (Replacement)
    if (isSignerLeaf(topology) || isSapientSignerLeaf(topology)) {
        // If this leaf holds the placeholder address, swap it
        if (Address.isEqual(topology.address, targetAddress)) {
            return {
                ...topology,
                address: replacementAddress,
            };
        }
    }
    // 4. Return other leaf types unchanged (Subdigest, NodeLeaf, etc.)
    return topology;
}
//# sourceMappingURL=config.js.map
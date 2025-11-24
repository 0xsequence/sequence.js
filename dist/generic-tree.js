import { Bytes, Hash, Hex } from 'ox';
export function isBranch(tree) {
    return Array.isArray(tree) && tree.length >= 2 && tree.every((child) => isTree(child));
}
export function isLeaf(tree) {
    return tree.type === 'leaf' && Bytes.validate(tree.value);
}
export function isTree(tree) {
    return isBranch(tree) || isLeaf(tree) || isNode(tree);
}
export function isNode(node) {
    return Hex.validate(node) && Hex.size(node) === 32;
}
export function hash(tree) {
    if (isBranch(tree)) {
        // Sequentially hash the children
        const hashedChildren = tree.map(hash);
        if (hashedChildren.length === 0) {
            throw new Error('Empty branch');
        }
        let chashBytes = Hex.toBytes(hashedChildren[0]);
        for (let i = 1; i < hashedChildren.length; i++) {
            chashBytes = Hash.keccak256(Bytes.concat(chashBytes, Hex.toBytes(hashedChildren[i])));
        }
        return Hex.fromBytes(chashBytes);
    }
    // Nodes are already hashed
    if (isNode(tree)) {
        return tree;
    }
    // Hash the leaf
    return Hash.keccak256(tree.value, { as: 'Hex' });
}
//# sourceMappingURL=generic-tree.js.map
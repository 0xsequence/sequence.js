import { Bytes, Hex } from 'ox';
export type Leaf = {
    type: 'leaf';
    value: Bytes.Bytes;
};
export type Node = Hex.Hex;
export type Branch = [Tree, Tree, ...Tree[]];
export type Tree = Branch | Leaf | Node;
export declare function isBranch(tree: Tree): tree is Branch;
export declare function isLeaf(tree: any): tree is Leaf;
export declare function isTree(tree: any): tree is Tree;
export declare function isNode(node: any): node is Node;
export declare function hash(tree: Tree): Hex.Hex;
//# sourceMappingURL=generic-tree.d.ts.map
import { Address, Bytes, Hex, Provider } from 'ox';
import { Config, Leaf, SapientSignerLeaf, SignerLeaf, Topology } from './config.js';
import { Parented } from './payload.js';
export declare const FLAG_SIGNATURE_HASH = 0;
export declare const FLAG_ADDRESS = 1;
export declare const FLAG_SIGNATURE_ERC1271 = 2;
export declare const FLAG_NODE = 3;
export declare const FLAG_BRANCH = 4;
export declare const FLAG_SUBDIGEST = 5;
export declare const FLAG_NESTED = 6;
export declare const FLAG_SIGNATURE_ETH_SIGN = 7;
export declare const FLAG_SIGNATURE_ANY_ADDRESS_SUBDIGEST = 8;
export declare const FLAG_SIGNATURE_SAPIENT = 9;
export declare const FLAG_SIGNATURE_SAPIENT_COMPACT = 10;
export type RSY = {
    r: bigint;
    s: bigint;
    yParity: number;
};
export type SignatureOfSignerLeafEthSign = {
    type: 'eth_sign';
} & RSY;
export type SignatureOfSignerLeafHash = {
    type: 'hash';
} & RSY;
export type SignatureOfSignerLeafErc1271 = {
    type: 'erc1271';
    address: `0x${string}`;
    data: Hex.Hex;
};
export type SignatureOfSignerLeaf = SignatureOfSignerLeafEthSign | SignatureOfSignerLeafHash | SignatureOfSignerLeafErc1271;
export type SignatureOfSapientSignerLeaf = {
    address: `0x${string}`;
    data: Hex.Hex;
    type: 'sapient' | 'sapient_compact';
};
export type SignedSignerLeaf = SignerLeaf & {
    signed: true;
    signature: SignatureOfSignerLeaf;
};
export type SignedSapientSignerLeaf = SapientSignerLeaf & {
    signed: true;
    signature: SignatureOfSapientSignerLeaf;
};
export type RawSignerLeaf = {
    type: 'unrecovered-signer';
    weight: bigint;
    signature: SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf;
};
export type RawNestedLeaf = {
    type: 'nested';
    tree: RawTopology;
    weight: bigint;
    threshold: bigint;
};
export type RawLeaf = Leaf | RawSignerLeaf | RawNestedLeaf;
export type RawNode = [RawTopology, RawTopology];
export type RawTopology = RawNode | RawLeaf;
export type RawConfig = {
    threshold: bigint;
    checkpoint: bigint;
    topology: RawTopology;
    checkpointer?: Address.Address;
};
export type RawSignature = {
    noChainId: boolean;
    checkpointerData?: Bytes.Bytes;
    configuration: RawConfig;
    suffix?: RawSignature[];
    erc6492?: {
        to: Address.Address;
        data: Bytes.Bytes;
    };
};
export declare function isSignatureOfSapientSignerLeaf(signature: any): signature is SignatureOfSapientSignerLeaf;
export declare function isRawSignature(signature: any): signature is RawSignature;
export declare function isRawConfig(configuration: any): configuration is RawConfig;
export declare function isRawSignerLeaf(cand: any): cand is RawSignerLeaf;
export declare function isSignedSignerLeaf(cand: any): cand is SignedSignerLeaf;
export declare function isSignedSapientSignerLeaf(cand: any): cand is SignedSapientSignerLeaf;
export declare function isRawNode(cand: any): cand is RawNode;
export declare function isRawTopology(cand: any): cand is RawTopology;
export declare function isRawLeaf(cand: any): cand is RawLeaf;
export declare function isRawNestedLeaf(cand: any): cand is RawNestedLeaf;
export declare function decodeSignature(erc6492Signature: Bytes.Bytes): RawSignature;
export declare function parseBranch(signature: Bytes.Bytes): {
    nodes: RawTopology[];
    leftover: Bytes.Bytes;
};
export declare function fillLeaves(topology: Topology, signatureFor: (leaf: SignerLeaf | SapientSignerLeaf) => SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf | undefined): Topology;
export declare function encodeChainedSignature(signatures: RawSignature[]): Uint8Array;
export declare function encodeSignature(signature: RawSignature, skipCheckpointerData?: boolean, skipCheckpointerAddress?: boolean): Uint8Array;
export declare function encodeTopology(topology: Topology | RawTopology, options?: {
    noChainId?: boolean;
    checkpointerData?: Uint8Array;
}): Uint8Array;
export declare function rawSignatureToJson(signature: RawSignature): string;
export declare function rawSignatureFromJson(json: string): RawSignature;
export declare function recover(signature: RawSignature, wallet: Address.Address, chainId: number, payload: Parented, options?: {
    provider?: Provider.Provider | {
        provider: Provider.Provider;
        block: number;
    } | 'assume-valid' | 'assume-invalid';
}): Promise<{
    configuration: Config;
    weight: bigint;
}>;
//# sourceMappingURL=signature.d.ts.map
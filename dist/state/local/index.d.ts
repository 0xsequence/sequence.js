import { Context, Payload, Signature, Config, Extensions, GenericTree } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Provider as ProviderInterface } from '../index.js';
export interface Store {
    loadConfig: (imageHash: Hex.Hex) => Promise<Config.Config | undefined>;
    saveConfig: (imageHash: Hex.Hex, config: Config.Config) => Promise<void>;
    loadCounterfactualWallet: (wallet: Address.Address) => Promise<{
        imageHash: Hex.Hex;
        context: Context.Context;
    } | undefined>;
    saveCounterfactualWallet: (wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context) => Promise<void>;
    loadPayloadOfSubdigest: (subdigest: Hex.Hex) => Promise<{
        content: Payload.Parented;
        chainId: number;
        wallet: Address.Address;
    } | undefined>;
    savePayloadOfSubdigest: (subdigest: Hex.Hex, payload: {
        content: Payload.Parented;
        chainId: number;
        wallet: Address.Address;
    }) => Promise<void>;
    loadSubdigestsOfSigner: (signer: Address.Address) => Promise<Hex.Hex[]>;
    loadSignatureOfSubdigest: (signer: Address.Address, subdigest: Hex.Hex) => Promise<Signature.SignatureOfSignerLeaf | undefined>;
    saveSignatureOfSubdigest: (signer: Address.Address, subdigest: Hex.Hex, signature: Signature.SignatureOfSignerLeaf) => Promise<void>;
    loadSubdigestsOfSapientSigner: (signer: Address.Address, imageHash: Hex.Hex) => Promise<Hex.Hex[]>;
    loadSapientSignatureOfSubdigest: (signer: Address.Address, subdigest: Hex.Hex, imageHash: Hex.Hex) => Promise<Signature.SignatureOfSapientSignerLeaf | undefined>;
    saveSapientSignatureOfSubdigest: (signer: Address.Address, subdigest: Hex.Hex, imageHash: Hex.Hex, signature: Signature.SignatureOfSapientSignerLeaf) => Promise<void>;
    loadTree: (rootHash: Hex.Hex) => Promise<GenericTree.Tree | undefined>;
    saveTree: (rootHash: Hex.Hex, tree: GenericTree.Tree) => Promise<void>;
}
export declare class Provider implements ProviderInterface {
    private readonly store;
    readonly extensions: Extensions.Extensions;
    constructor(store?: Store, extensions?: Extensions.Extensions);
    getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined>;
    saveWallet(deployConfiguration: Config.Config, context: Context.Context): Promise<void>;
    saveConfig(config: Config.Config): Promise<void>;
    saveCounterfactualWallet(wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context): void | Promise<void>;
    getDeploy(wallet: Address.Address): Promise<{
        imageHash: Hex.Hex;
        context: Context.Context;
    } | undefined>;
    private getWalletsGeneric;
    getWallets(signer: Address.Address): Promise<Record<`0x${string}`, {
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSignerLeaf;
    }>>;
    getWalletsForSapient(signer: Address.Address, imageHash: Hex.Hex): Promise<Record<`0x${string}`, {
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSapientSignerLeaf;
    }>>;
    getWitnessFor(wallet: Address.Address, signer: Address.Address): {
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSignerLeaf;
    } | Promise<{
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSignerLeaf;
    } | undefined> | undefined;
    getWitnessForSapient(wallet: Address.Address, signer: Address.Address, imageHash: Hex.Hex): {
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSapientSignerLeaf;
    } | Promise<{
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSapientSignerLeaf;
    } | undefined> | undefined;
    saveWitnesses(wallet: Address.Address, chainId: number, payload: Payload.Parented, signatures: Signature.RawTopology): Promise<void>;
    getConfigurationUpdates(wallet: Address.Address, fromImageHash: Hex.Hex, options?: {
        allUpdates?: boolean;
    }): Promise<{
        imageHash: Hex.Hex;
        signature: Signature.RawSignature;
    }[]>;
    saveUpdate(wallet: Address.Address, configuration: Config.Config, signature: Signature.RawSignature): Promise<void>;
    saveSignature(subdigest: Hex.Hex, topology: Signature.RawTopology): Promise<void>;
    getTree(rootHash: Hex.Hex): GenericTree.Tree | Promise<GenericTree.Tree | undefined> | undefined;
    saveTree(tree: GenericTree.Tree): void | Promise<void>;
    saveConfiguration(config: Config.Config): Promise<void>;
    saveDeploy(imageHash: Hex.Hex, context: Context.Context): Promise<void>;
    getPayload(opHash: Hex.Hex): Promise<{
        chainId: number;
        payload: Payload.Parented;
        wallet: Address.Address;
    } | undefined>;
    savePayload(wallet: Address.Address, payload: Payload.Parented, chainId: number): Promise<void>;
}
export * from './memory.js';
export * from './indexed-db.js';
//# sourceMappingURL=index.d.ts.map
import { Context, Payload, Signature, Config, GenericTree } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Store } from './index.js';
export declare class IndexedDbStore implements Store {
    private _db;
    private dbName;
    constructor(dbName?: string);
    private openDB;
    private get;
    private put;
    private getSet;
    private putSet;
    private getSignatureKey;
    private getSapientSignatureKey;
    loadConfig(imageHash: Hex.Hex): Promise<Config.Config | undefined>;
    saveConfig(imageHash: Hex.Hex, config: Config.Config): Promise<void>;
    loadCounterfactualWallet(wallet: Address.Address): Promise<{
        imageHash: Hex.Hex;
        context: Context.Context;
    } | undefined>;
    saveCounterfactualWallet(wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context): Promise<void>;
    loadPayloadOfSubdigest(subdigest: Hex.Hex): Promise<{
        content: Payload.Parented;
        chainId: number;
        wallet: Address.Address;
    } | undefined>;
    savePayloadOfSubdigest(subdigest: Hex.Hex, payload: {
        content: Payload.Parented;
        chainId: number;
        wallet: Address.Address;
    }): Promise<void>;
    loadSubdigestsOfSigner(signer: Address.Address): Promise<Hex.Hex[]>;
    loadSignatureOfSubdigest(signer: Address.Address, subdigest: Hex.Hex): Promise<Signature.SignatureOfSignerLeaf | undefined>;
    saveSignatureOfSubdigest(signer: Address.Address, subdigest: Hex.Hex, signature: Signature.SignatureOfSignerLeaf): Promise<void>;
    loadSubdigestsOfSapientSigner(signer: Address.Address, imageHash: Hex.Hex): Promise<Hex.Hex[]>;
    loadSapientSignatureOfSubdigest(signer: Address.Address, subdigest: Hex.Hex, imageHash: Hex.Hex): Promise<Signature.SignatureOfSapientSignerLeaf | undefined>;
    saveSapientSignatureOfSubdigest(signer: Address.Address, subdigest: Hex.Hex, imageHash: Hex.Hex, signature: Signature.SignatureOfSapientSignerLeaf): Promise<void>;
    loadTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined>;
    saveTree(rootHash: Hex.Hex, tree: GenericTree.Tree): Promise<void>;
}
//# sourceMappingURL=indexed-db.d.ts.map
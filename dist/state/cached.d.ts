import { Address, Hex } from 'ox';
import { MaybePromise, Provider } from './index.js';
import { Config, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives';
export declare class Cached implements Provider {
    private readonly args;
    constructor(args: {
        readonly source: Provider;
        readonly cache: Provider;
    });
    getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined>;
    getDeploy(wallet: Address.Address): Promise<{
        imageHash: Hex.Hex;
        context: Context.Context;
    } | undefined>;
    getWallets(signer: Address.Address): Promise<{
        [wallet: Address.Address]: {
            chainId: number;
            payload: Payload.Parented;
            signature: Signature.SignatureOfSignerLeaf;
        };
    }>;
    getWalletsForSapient(signer: Address.Address, imageHash: Hex.Hex): Promise<{
        [wallet: Address.Address]: {
            chainId: number;
            payload: Payload.Parented;
            signature: Signature.SignatureOfSapientSignerLeaf;
        };
    }>;
    getWitnessFor(wallet: Address.Address, signer: Address.Address): Promise<{
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSignerLeaf;
    } | undefined>;
    getWitnessForSapient(wallet: Address.Address, signer: Address.Address, imageHash: Hex.Hex): Promise<{
        chainId: number;
        payload: Payload.Parented;
        signature: Signature.SignatureOfSapientSignerLeaf;
    } | undefined>;
    getConfigurationUpdates(wallet: Address.Address, fromImageHash: Hex.Hex, options?: {
        allUpdates?: boolean;
    }): Promise<Array<{
        imageHash: Hex.Hex;
        signature: Signature.RawSignature;
    }>>;
    getTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined>;
    saveWallet(deployConfiguration: Config.Config, context: Context.Context): MaybePromise<void>;
    saveWitnesses(wallet: Address.Address, chainId: number, payload: Payload.Parented, signatures: Signature.RawTopology): MaybePromise<void>;
    saveUpdate(wallet: Address.Address, configuration: Config.Config, signature: Signature.RawSignature): MaybePromise<void>;
    saveTree(tree: GenericTree.Tree): MaybePromise<void>;
    saveConfiguration(config: Config.Config): MaybePromise<void>;
    saveDeploy(imageHash: Hex.Hex, context: Context.Context): MaybePromise<void>;
    getPayload(opHash: Hex.Hex): Promise<{
        chainId: number;
        payload: Payload.Parented;
        wallet: Address.Address;
    } | undefined>;
    savePayload(wallet: Address.Address, payload: Payload.Parented, chainId: number): MaybePromise<void>;
}
//# sourceMappingURL=cached.d.ts.map
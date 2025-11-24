import { Config, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Provider as ProviderInterface } from '../index.js';
export declare class Provider implements ProviderInterface {
    private readonly service;
    constructor(host?: string);
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
    getPayload(opHash: Hex.Hex): Promise<{
        chainId: number;
        payload: Payload.Parented;
        wallet: Address.Address;
    } | undefined>;
    saveWallet(deployConfiguration: Config.Config, context: Context.Context): Promise<void>;
    saveWitnesses(wallet: Address.Address, chainId: number, payload: Payload.Parented, signatures: Signature.RawTopology): Promise<void>;
    saveUpdate(wallet: Address.Address, configuration: Config.Config, signature: Signature.RawSignature): Promise<void>;
    saveTree(tree: GenericTree.Tree): Promise<void>;
    saveConfiguration(config: Config.Config): Promise<void>;
    saveDeploy(_imageHash: Hex.Hex, _context: Context.Context): Promise<void>;
    savePayload(wallet: Address.Address, payload: Payload.Parented, chainId: number): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map
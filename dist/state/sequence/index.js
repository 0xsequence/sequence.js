import { Config, Constants, Extensions, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives';
import { AbiFunction, Address, Bytes, Hex, Signature as oxSignature, } from 'ox';
import { normalizeAddressKeys } from '../index.js';
import { Sessions, SignatureType } from './sessions.gen.js';
export class Provider {
    service;
    constructor(host = 'https://keymachine.sequence.app') {
        this.service = new Sessions(host, fetch);
    }
    async getConfiguration(imageHash) {
        const { version, config } = await this.service.config({ imageHash });
        if (version !== 3) {
            throw new Error(`invalid configuration version ${version}, expected version 3`);
        }
        return fromServiceConfig(config);
    }
    async getDeploy(wallet) {
        const { deployHash, context } = await this.service.deployHash({ wallet });
        Hex.assert(deployHash);
        Address.assert(context.factory);
        Address.assert(context.mainModule);
        Address.assert(context.mainModuleUpgradable);
        Hex.assert(context.walletCreationCode);
        return {
            imageHash: deployHash,
            context: {
                factory: context.factory,
                stage1: context.mainModule,
                stage2: context.mainModuleUpgradable,
                creationCode: context.walletCreationCode,
            },
        };
    }
    async getWallets(signer) {
        const result = await this.service.wallets({ signer });
        const wallets = normalizeAddressKeys(result.wallets);
        return Object.fromEntries(Object.entries(wallets).map(([wallet, signature]) => {
            Address.assert(wallet);
            Hex.assert(signature.signature);
            switch (signature.type) {
                case SignatureType.EIP712:
                    return [
                        wallet,
                        {
                            chainId: Number(signature.chainID),
                            payload: fromServicePayload(signature.payload),
                            signature: { type: 'hash', ...oxSignature.from(signature.signature) },
                        },
                    ];
                case SignatureType.EthSign:
                    return [
                        wallet,
                        {
                            chainId: Number(signature.chainID),
                            payload: fromServicePayload(signature.payload),
                            signature: { type: 'eth_sign', ...oxSignature.from(signature.signature) },
                        },
                    ];
                case SignatureType.EIP1271:
                    return [
                        wallet,
                        {
                            chainId: Number(signature.chainID),
                            payload: fromServicePayload(signature.payload),
                            signature: { type: 'erc1271', address: signer, data: signature.signature },
                        },
                    ];
                case SignatureType.Sapient:
                    throw new Error(`unexpected sapient signature by ${signer}`);
                case SignatureType.SapientCompact:
                    throw new Error(`unexpected compact sapient signature by ${signer}`);
            }
        }));
    }
    async getWalletsForSapient(signer, imageHash) {
        const result = await this.service.wallets({ signer, sapientHash: imageHash });
        const wallets = normalizeAddressKeys(result.wallets);
        return Object.fromEntries(Object.entries(wallets).map(([wallet, signature]) => {
            Address.assert(wallet);
            Hex.assert(signature.signature);
            switch (signature.type) {
                case SignatureType.EIP712:
                    throw new Error(`unexpected eip-712 signature by ${signer}`);
                case SignatureType.EthSign:
                    throw new Error(`unexpected eth_sign signature by ${signer}`);
                case SignatureType.EIP1271:
                    throw new Error(`unexpected erc-1271 signature by ${signer}`);
                case SignatureType.Sapient:
                    return [
                        wallet,
                        {
                            chainId: Number(signature.chainID),
                            payload: fromServicePayload(signature.payload),
                            signature: { type: 'sapient', address: signer, data: signature.signature },
                        },
                    ];
                case SignatureType.SapientCompact:
                    return [
                        wallet,
                        {
                            chainId: Number(signature.chainID),
                            payload: fromServicePayload(signature.payload),
                            signature: { type: 'sapient_compact', address: signer, data: signature.signature },
                        },
                    ];
            }
        }));
    }
    async getWitnessFor(wallet, signer) {
        try {
            const { witness } = await this.service.witness({ signer, wallet });
            Hex.assert(witness.signature);
            switch (witness.type) {
                case SignatureType.EIP712:
                    return {
                        chainId: Number(witness.chainID),
                        payload: fromServicePayload(witness.payload),
                        signature: { type: 'hash', ...oxSignature.from(witness.signature) },
                    };
                case SignatureType.EthSign:
                    return {
                        chainId: Number(witness.chainID),
                        payload: fromServicePayload(witness.payload),
                        signature: { type: 'eth_sign', ...oxSignature.from(witness.signature) },
                    };
                case SignatureType.EIP1271:
                    return {
                        chainId: Number(witness.chainID),
                        payload: fromServicePayload(witness.payload),
                        signature: { type: 'erc1271', address: signer, data: witness.signature },
                    };
                case SignatureType.Sapient:
                    throw new Error(`unexpected sapient signature by ${signer}`);
                case SignatureType.SapientCompact:
                    throw new Error(`unexpected compact sapient signature by ${signer}`);
            }
        }
        catch { }
    }
    async getWitnessForSapient(wallet, signer, imageHash) {
        try {
            const { witness } = await this.service.witness({ signer, wallet, sapientHash: imageHash });
            Hex.assert(witness.signature);
            switch (witness.type) {
                case SignatureType.EIP712:
                    throw new Error(`unexpected eip-712 signature by ${signer}`);
                case SignatureType.EthSign:
                    throw new Error(`unexpected eth_sign signature by ${signer}`);
                case SignatureType.EIP1271:
                    throw new Error(`unexpected erc-1271 signature by ${signer}`);
                case SignatureType.Sapient:
                    return {
                        chainId: Number(witness.chainID),
                        payload: fromServicePayload(witness.payload),
                        signature: { type: 'sapient', address: signer, data: witness.signature },
                    };
                case SignatureType.SapientCompact:
                    return {
                        chainId: Number(witness.chainID),
                        payload: fromServicePayload(witness.payload),
                        signature: { type: 'sapient_compact', address: signer, data: witness.signature },
                    };
            }
        }
        catch { }
    }
    async getConfigurationUpdates(wallet, fromImageHash, options) {
        const { updates } = await this.service.configUpdates({ wallet, fromImageHash, allUpdates: options?.allUpdates });
        return Promise.all(updates.map(async ({ toImageHash, signature }) => {
            Hex.assert(toImageHash);
            Hex.assert(signature);
            const decoded = Signature.decodeSignature(Hex.toBytes(signature));
            const { configuration } = await Signature.recover(decoded, wallet, 0, Payload.fromConfigUpdate(toImageHash), {
                provider: passkeySignatureValidator,
            });
            return { imageHash: toImageHash, signature: { ...decoded, configuration } };
        }));
    }
    async getTree(rootHash) {
        const { version, tree } = await this.service.tree({ imageHash: rootHash });
        if (version !== 3) {
            throw new Error(`invalid tree version ${version}, expected version 3`);
        }
        return fromServiceTree(tree);
    }
    async getPayload(opHash) {
        const { version, payload, wallet, chainID } = await this.service.payload({ digest: opHash });
        if (version !== 3) {
            throw new Error(`invalid payload version ${version}, expected version 3`);
        }
        Address.assert(wallet);
        return { payload: fromServicePayload(payload), wallet, chainId: Number(chainID) };
    }
    async saveWallet(deployConfiguration, context) {
        await this.service.saveWallet({
            version: 3,
            deployConfig: getServiceConfig(deployConfiguration),
            context: {
                version: 3,
                factory: context.factory,
                mainModule: context.stage1,
                mainModuleUpgradable: context.stage2,
                guestModule: Constants.DefaultGuestAddress,
                walletCreationCode: context.creationCode,
            },
        });
    }
    async saveWitnesses(wallet, chainId, payload, signatures) {
        await this.service.saveSignerSignatures3({
            wallet,
            payload: getServicePayload(payload),
            chainID: chainId.toString(),
            signatures: getSignerSignatures(signatures).map((signature) => {
                switch (signature.type) {
                    case 'hash':
                        return { type: SignatureType.EIP712, signature: oxSignature.toHex(oxSignature.from(signature)) };
                    case 'eth_sign':
                        return { type: SignatureType.EthSign, signature: oxSignature.toHex(oxSignature.from(signature)) };
                    case 'erc1271':
                        return {
                            type: SignatureType.EIP1271,
                            signer: signature.address,
                            signature: signature.data,
                            referenceChainID: chainId.toString(),
                        };
                    case 'sapient':
                        return {
                            type: SignatureType.Sapient,
                            signer: signature.address,
                            signature: signature.data,
                            referenceChainID: chainId.toString(),
                        };
                    case 'sapient_compact':
                        return {
                            type: SignatureType.SapientCompact,
                            signer: signature.address,
                            signature: signature.data,
                            referenceChainID: chainId.toString(),
                        };
                }
            }),
        });
    }
    async saveUpdate(wallet, configuration, signature) {
        await this.service.saveSignature2({
            wallet,
            payload: getServicePayload(Payload.fromConfigUpdate(Bytes.toHex(Config.hashConfiguration(configuration)))),
            chainID: '0',
            signature: Bytes.toHex(Signature.encodeSignature(signature)),
            toConfig: getServiceConfig(configuration),
        });
    }
    async saveTree(tree) {
        await this.service.saveTree({ version: 3, tree: getServiceTree(tree) });
    }
    async saveConfiguration(config) {
        await this.service.saveConfig({ version: 3, config: getServiceConfig(config) });
    }
    async saveDeploy(_imageHash, _context) {
        // TODO: save deploy hash even if we don't have its configuration
    }
    async savePayload(wallet, payload, chainId) {
        await this.service.savePayload({
            version: 3,
            payload: getServicePayload(payload),
            wallet,
            chainID: chainId.toString(),
        });
    }
}
const passkeySigners = [
    Extensions.Dev1.passkeys,
    Extensions.Dev2.passkeys,
    Extensions.Rc3.passkeys,
    Extensions.Rc4.passkeys,
].map(Address.checksum);
const recoverSapientSignatureCompactSignature = 'function recoverSapientSignatureCompact(bytes32 _digest, bytes _signature) view returns (bytes32)';
const recoverSapientSignatureCompactFunction = AbiFunction.from(recoverSapientSignatureCompactSignature);
class PasskeySignatureValidator {
    request = (({ method, params }) => {
        switch (method) {
            case 'eth_call':
                const transaction = params[0];
                if (!transaction.data?.startsWith(AbiFunction.getSelector(recoverSapientSignatureCompactFunction))) {
                    throw new Error(`unknown selector ${transaction.data?.slice(0, 10)}, expected selector ${AbiFunction.getSelector(recoverSapientSignatureCompactFunction)} for ${recoverSapientSignatureCompactSignature}`);
                }
                if (!passkeySigners.includes(transaction.to ? Address.checksum(transaction.to) : '0x')) {
                    throw new Error(`unknown passkey signer ${transaction.to}`);
                }
                const [digest, signature] = AbiFunction.decodeData(recoverSapientSignatureCompactFunction, transaction.data);
                const decoded = Extensions.Passkeys.decode(Hex.toBytes(signature));
                if (Extensions.Passkeys.isValidSignature(digest, decoded)) {
                    return Extensions.Passkeys.rootFor(decoded.publicKey);
                }
                else {
                    throw new Error(`invalid passkey signature ${signature} for digest ${digest}`);
                }
            default:
                throw new Error(`method ${method} not implemented`);
        }
    });
    on(event) {
        throw new Error(`unable to listen for ${event}: not implemented`);
    }
    removeListener(event) {
        throw new Error(`unable to remove listener for ${event}: not implemented`);
    }
}
const passkeySignatureValidator = new PasskeySignatureValidator();
function getServiceConfig(config) {
    return {
        threshold: encodeBigInt(config.threshold),
        checkpoint: encodeBigInt(config.checkpoint),
        checkpointer: config.checkpointer,
        tree: getServiceConfigTree(config.topology),
    };
}
function fromServiceConfig(config) {
    if (config.checkpointer !== undefined) {
        Address.assert(config.checkpointer);
    }
    return {
        threshold: BigInt(config.threshold),
        checkpoint: BigInt(config.checkpoint),
        checkpointer: config.checkpointer,
        topology: fromServiceConfigTree(config.tree),
    };
}
function getServiceConfigTree(topology) {
    if (Config.isNode(topology)) {
        return [getServiceConfigTree(topology[0]), getServiceConfigTree(topology[1])];
    }
    else if (Config.isSignerLeaf(topology)) {
        return { weight: encodeBigInt(topology.weight), address: topology.address };
    }
    else if (Config.isSapientSignerLeaf(topology)) {
        return { weight: encodeBigInt(topology.weight), address: topology.address, imageHash: topology.imageHash };
    }
    else if (Config.isSubdigestLeaf(topology)) {
        return { subdigest: topology.digest };
    }
    else if (Config.isAnyAddressSubdigestLeaf(topology)) {
        return { subdigest: topology.digest, isAnyAddress: true };
    }
    else if (Config.isNestedLeaf(topology)) {
        return {
            weight: encodeBigInt(topology.weight),
            threshold: encodeBigInt(topology.threshold),
            tree: getServiceConfigTree(topology.tree),
        };
    }
    else if (Config.isNodeLeaf(topology)) {
        return topology;
    }
    else {
        throw new Error(`unknown topology '${JSON.stringify(topology)}'`);
    }
}
function fromServiceConfigTree(tree) {
    switch (typeof tree) {
        case 'string':
            Hex.assert(tree);
            return tree;
        case 'object':
            if (tree instanceof Array) {
                return [fromServiceConfigTree(tree[0]), fromServiceConfigTree(tree[1])];
            }
            if ('weight' in tree) {
                if ('address' in tree) {
                    Address.assert(tree.address);
                    if (tree.imageHash) {
                        Hex.assert(tree.imageHash);
                        return {
                            type: 'sapient-signer',
                            address: tree.address,
                            weight: BigInt(tree.weight),
                            imageHash: tree.imageHash,
                        };
                    }
                    else {
                        return { type: 'signer', address: tree.address, weight: BigInt(tree.weight) };
                    }
                }
                if ('tree' in tree) {
                    return {
                        type: 'nested',
                        weight: BigInt(tree.weight),
                        threshold: BigInt(tree.threshold),
                        tree: fromServiceConfigTree(tree.tree),
                    };
                }
            }
            if ('subdigest' in tree) {
                Hex.assert(tree.subdigest);
                return { type: tree.isAnyAddress ? 'any-address-subdigest' : 'subdigest', digest: tree.subdigest };
            }
    }
    throw new Error(`unknown config tree '${JSON.stringify(tree)}'`);
}
function getServicePayload(payload) {
    if (Payload.isCalls(payload)) {
        return {
            type: 'call',
            space: encodeBigInt(payload.space),
            nonce: encodeBigInt(payload.nonce),
            calls: payload.calls.map(getServicePayloadCall),
        };
    }
    else if (Payload.isMessage(payload)) {
        return { type: 'message', message: payload.message };
    }
    else if (Payload.isConfigUpdate(payload)) {
        return { type: 'config-update', imageHash: payload.imageHash };
    }
    else if (Payload.isDigest(payload)) {
        return { type: 'digest', digest: payload.digest };
    }
    else {
        throw new Error(`unknown payload '${JSON.stringify(payload)}'`);
    }
}
function fromServicePayload(payload) {
    switch (payload.type) {
        case 'call':
            return {
                type: 'call',
                space: BigInt(payload.space),
                nonce: BigInt(payload.nonce),
                calls: payload.calls.map(fromServicePayloadCall),
            };
        case 'message':
            Hex.assert(payload.message);
            return { type: 'message', message: payload.message };
        case 'config-update':
            Hex.assert(payload.imageHash);
            return { type: 'config-update', imageHash: payload.imageHash };
        case 'digest':
            Hex.assert(payload.digest);
            return { type: 'digest', digest: payload.digest };
    }
}
function getServicePayloadCall(call) {
    return {
        to: call.to,
        value: encodeBigInt(call.value),
        data: call.data,
        gasLimit: encodeBigInt(call.gasLimit),
        delegateCall: call.delegateCall,
        onlyFallback: call.onlyFallback,
        behaviorOnError: call.behaviorOnError,
    };
}
function fromServicePayloadCall(call) {
    Address.assert(call.to);
    Hex.assert(call.data);
    return {
        to: call.to,
        value: BigInt(call.value),
        data: call.data,
        gasLimit: BigInt(call.gasLimit),
        delegateCall: call.delegateCall,
        onlyFallback: call.onlyFallback,
        behaviorOnError: call.behaviorOnError,
    };
}
function getServiceTree(tree) {
    if (GenericTree.isBranch(tree)) {
        return tree.map(getServiceTree);
    }
    else if (GenericTree.isLeaf(tree)) {
        return { data: Bytes.toHex(tree.value) };
    }
    else if (GenericTree.isNode(tree)) {
        return tree;
    }
    else {
        throw new Error(`unknown tree '${JSON.stringify(tree)}'`);
    }
}
function fromServiceTree(tree) {
    switch (typeof tree) {
        case 'string':
            Hex.assert(tree);
            return tree;
        case 'object':
            if (tree instanceof Array) {
                return tree.map(fromServiceTree);
            }
            if ('data' in tree) {
                Hex.assert(tree.data);
                return { type: 'leaf', value: Hex.toBytes(tree.data) };
            }
    }
    throw new Error(`unknown tree '${JSON.stringify(tree)}'`);
}
function encodeBigInt(value) {
    return value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER ? value.toString() : Number(value);
}
function getSignerSignatures(topology) {
    if (Signature.isRawNode(topology)) {
        return [...getSignerSignatures(topology[0]), ...getSignerSignatures(topology[1])];
    }
    else if (Signature.isRawSignerLeaf(topology)) {
        return [topology.signature];
    }
    else if (Config.isNestedLeaf(topology)) {
        return getSignerSignatures(topology.tree);
    }
    else if (Signature.isRawNestedLeaf(topology)) {
        return getSignerSignatures(topology.tree);
    }
    else if (Config.isSignerLeaf(topology)) {
        return topology.signature ? [topology.signature] : [];
    }
    else if (Config.isSapientSignerLeaf(topology)) {
        return topology.signature ? [topology.signature] : [];
    }
    else if (Config.isSubdigestLeaf(topology)) {
        return [];
    }
    else if (Config.isAnyAddressSubdigestLeaf(topology)) {
        return [];
    }
    else if (Config.isNodeLeaf(topology)) {
        return [];
    }
    else {
        throw new Error(`unknown topology '${JSON.stringify(topology)}'`);
    }
}

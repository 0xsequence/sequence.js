import { Config, Constants, Context, Erc6492, Payload, Address as SequenceAddress, Signature as SequenceSignature, } from '@0xsequence/wallet-primitives';
import { AbiFunction, Address, Bytes, Hex, TypedData } from 'ox';
import * as Envelope from './envelope.js';
import * as State from './state/index.js';
import { UserOperation } from 'ox/erc4337';
export const DefaultWalletOptions = {
    knownContexts: Context.KnownContexts,
    stateProvider: new State.Sequence.Provider(),
    guest: Constants.DefaultGuestAddress,
};
export class Wallet {
    address;
    guest;
    stateProvider;
    knownContexts;
    constructor(address, options) {
        this.address = address;
        const combinedContexts = [...DefaultWalletOptions.knownContexts, ...(options?.knownContexts ?? [])];
        const combinedOptions = { ...DefaultWalletOptions, ...options, knownContexts: combinedContexts };
        this.guest = combinedOptions.guest;
        this.stateProvider = combinedOptions.stateProvider;
        this.knownContexts = combinedOptions.knownContexts;
    }
    /**
     * Creates a new counter-factual wallet using the provided configuration.
     * Saves the wallet in the state provider, so you can get its imageHash from its address,
     * and its configuration from its imageHash.
     *
     * @param configuration - The wallet configuration to use.
     * @param options - Optional wallet options.
     * @returns A Promise that resolves to the new Wallet instance.
     */
    static async fromConfiguration(configuration, options) {
        const context = options?.context ?? Context.Dev2;
        const merged = { ...DefaultWalletOptions, ...options };
        if (!merged.unsafe) {
            Config.evaluateConfigurationSafety(configuration);
        }
        await merged.stateProvider.saveWallet(configuration, context);
        return new Wallet(SequenceAddress.from(configuration, context), merged);
    }
    async isDeployed(provider) {
        return (await provider.request({ method: 'eth_getCode', params: [this.address, 'pending'] })) !== '0x';
    }
    async buildDeployTransaction() {
        const deployInformation = await this.stateProvider.getDeploy(this.address);
        if (!deployInformation) {
            throw new Error(`cannot find deploy information for ${this.address}`);
        }
        return Erc6492.deploy(deployInformation.imageHash, deployInformation.context);
    }
    /**
     * Prepares an envelope for updating the wallet's configuration.
     *
     * This function creates the necessary envelope that must be signed in order to update
     * the configuration of a wallet. If the `unsafe` option is set to true, no sanity checks
     * will be performed on the provided configuration. Otherwise, the configuration will be
     * validated for safety (e.g., weights, thresholds).
     *
     * Note: This function does not directly update the wallet's configuration. The returned
     * envelope must be signed and then submitted using the `submitUpdate` method to apply
     * the configuration change.
     *
     * @param configuration - The new wallet configuration to be proposed.
     * @param options - Options for preparing the update. If `unsafe` is true, skips safety checks.
     * @returns A promise that resolves to an unsigned envelope for the configuration update.
     */
    async prepareUpdate(configuration, options) {
        if (!options?.unsafe) {
            Config.evaluateConfigurationSafety(configuration);
        }
        const imageHash = Config.hashConfiguration(configuration);
        const blankEnvelope = (await Promise.all([this.prepareBlankEnvelope(0), this.stateProvider.saveConfiguration(configuration)]))[0];
        return {
            ...blankEnvelope,
            payload: Payload.fromConfigUpdate(Bytes.toHex(imageHash)),
        };
    }
    async submitUpdate(envelope, options) {
        const [status, newConfig] = await Promise.all([
            this.getStatus(),
            this.stateProvider.getConfiguration(envelope.payload.imageHash),
        ]);
        if (!newConfig) {
            throw new Error(`cannot find configuration details for ${envelope.payload.imageHash}`);
        }
        // Verify the new configuration is valid
        const updatedEnvelope = { ...envelope, configuration: status.configuration };
        const { weight, threshold } = Envelope.weightOf(updatedEnvelope);
        if (weight < threshold) {
            throw new Error('insufficient weight in envelope');
        }
        const signature = Envelope.encodeSignature(updatedEnvelope);
        await this.stateProvider.saveUpdate(this.address, newConfig, signature);
        if (!options?.noValidateSave) {
            const status = await this.getStatus();
            if (Hex.from(Config.hashConfiguration(status.configuration)) !== envelope.payload.imageHash) {
                throw new Error('configuration not saved');
            }
        }
    }
    async getStatus(provider) {
        let isDeployed = false;
        let implementation;
        let chainId;
        let imageHash;
        let updates = [];
        let onChainImageHash;
        let stage;
        const deployInformation = await this.stateProvider.getDeploy(this.address);
        if (!deployInformation) {
            throw new Error(`cannot find deploy information for ${this.address}`);
        }
        // Try to use a context from the known contexts, so we populate
        // the capabilities of the context
        const counterFactualContext = this.knownContexts.find((kc) => Address.isEqual(deployInformation.context.factory, kc.factory) &&
            Address.isEqual(deployInformation.context.stage1, kc.stage1)) ?? deployInformation.context;
        let context;
        if (provider) {
            // Get chain ID, deployment status, and implementation
            const requests = await Promise.all([
                provider.request({ method: 'eth_chainId' }),
                this.isDeployed(provider),
                provider
                    .request({
                    method: 'eth_call',
                    params: [{ to: this.address, data: AbiFunction.encodeData(Constants.GET_IMPLEMENTATION) }, 'latest'],
                })
                    .then((res) => {
                    const address = `0x${res.slice(-40)}`;
                    Address.assert(address, { strict: false });
                    return address;
                })
                    .catch(() => undefined),
            ]);
            chainId = Number(requests[0]);
            isDeployed = requests[1];
            implementation = requests[2];
            // Try to find the context from the known contexts (or use the counterfactual context)
            context = implementation
                ? [...this.knownContexts, counterFactualContext].find((kc) => Address.isEqual(implementation, kc.stage1) || Address.isEqual(implementation, kc.stage2))
                : counterFactualContext;
            if (!context) {
                throw new Error(`cannot find context for ${this.address}`);
            }
            // Determine stage based on implementation address
            stage = implementation && Address.isEqual(implementation, context.stage2) ? 'stage2' : 'stage1';
            // Get image hash and updates
            if (isDeployed && stage === 'stage2') {
                // For deployed stage2 wallets, get the image hash from the contract
                onChainImageHash = await provider.request({
                    method: 'eth_call',
                    params: [{ to: this.address, data: AbiFunction.encodeData(Constants.IMAGE_HASH) }, 'latest'],
                });
            }
            else {
                // For non-deployed or stage1 wallets, get the deploy hash
                const deployInformation = await this.stateProvider.getDeploy(this.address);
                if (!deployInformation) {
                    throw new Error(`cannot find deploy information for ${this.address}`);
                }
                onChainImageHash = deployInformation.imageHash;
            }
            // Get configuration updates
            updates = await this.stateProvider.getConfigurationUpdates(this.address, onChainImageHash);
            imageHash = updates[updates.length - 1]?.imageHash ?? onChainImageHash;
        }
        else {
            // Without a provider, we can only get information from the state provider
            updates = await this.stateProvider.getConfigurationUpdates(this.address, deployInformation.imageHash);
            imageHash = updates[updates.length - 1]?.imageHash ?? deployInformation.imageHash;
        }
        // Get the current configuration
        const configuration = await this.stateProvider.getConfiguration(imageHash);
        if (!configuration) {
            throw new Error(`cannot find configuration details for ${this.address}`);
        }
        if (provider) {
            return {
                address: this.address,
                isDeployed,
                implementation,
                stage,
                configuration,
                imageHash,
                pendingUpdates: [...updates].reverse(),
                chainId,
                onChainImageHash: onChainImageHash,
                context,
            };
        }
        else {
            return {
                address: this.address,
                isDeployed,
                implementation,
                configuration,
                imageHash,
                pendingUpdates: [...updates].reverse(),
                chainId,
                counterFactual: {
                    context: counterFactualContext,
                    imageHash: deployInformation.imageHash,
                },
            };
        }
    }
    async getNonce(provider, space) {
        const result = await provider.request({
            method: 'eth_call',
            params: [{ to: this.address, data: AbiFunction.encodeData(Constants.READ_NONCE, [space]) }, 'latest'],
        });
        if (result === '0x' || result.length === 0) {
            return 0n;
        }
        return BigInt(result);
    }
    async get4337Nonce(provider, entrypoint, space) {
        const result = await provider.request({
            method: 'eth_call',
            params: [
                { to: entrypoint, data: AbiFunction.encodeData(Constants.READ_NONCE_4337, [this.address, space]) },
                'latest',
            ],
        });
        if (result === '0x' || result.length === 0) {
            return 0n;
        }
        // Mask lower 64 bits
        return BigInt(result) & 0xffffffffffffffffn;
    }
    async get4337Entrypoint(provider) {
        const status = await this.getStatus(provider);
        return status.context.capabilities?.erc4337?.entrypoint;
    }
    async prepare4337Transaction(provider, calls, options) {
        const space = options.space ?? 0n;
        // If safe mode is set, then we check that the transaction
        // is not "dangerous", aka it does not have any delegate calls
        // or calls to the wallet contract itself
        if (!options?.unsafe) {
            for (const call of calls) {
                if (call.delegateCall) {
                    throw new Error('delegate calls are not allowed in safe mode');
                }
                if (Address.isEqual(call.to, this.address)) {
                    throw new Error('calls to the wallet contract itself are not allowed in safe mode');
                }
            }
        }
        const [chainId, status] = await Promise.all([provider.request({ method: 'eth_chainId' }), this.getStatus(provider)]);
        // If entrypoint is address(0) then 4337 is not enabled in this wallet
        if (!status.context.capabilities?.erc4337?.entrypoint) {
            throw new Error('4337 is not enabled in this wallet');
        }
        const noncePromise = this.get4337Nonce(provider, status.context.capabilities?.erc4337?.entrypoint, space);
        // If the wallet is not deployed, then we need to include the initCode on
        // the 4337 transaction
        let factory;
        let factoryData;
        if (!status.isDeployed) {
            const deploy = await this.buildDeployTransaction();
            factory = deploy.to;
            factoryData = deploy.data;
        }
        // If the latest configuration does not match the onchain configuration
        // then we bundle the update into the transaction envelope
        if (!options?.noConfigUpdate) {
            const status = await this.getStatus(provider);
            if (status.imageHash !== status.onChainImageHash) {
                calls.push({
                    to: this.address,
                    value: 0n,
                    data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [status.imageHash]),
                    gasLimit: 0n,
                    delegateCall: false,
                    onlyFallback: false,
                    behaviorOnError: 'revert',
                });
            }
        }
        return {
            payload: {
                type: 'call_4337_07',
                nonce: await noncePromise,
                space,
                calls,
                entrypoint: status.context.capabilities?.erc4337?.entrypoint,
                callGasLimit: 0n,
                maxFeePerGas: 0n,
                maxPriorityFeePerGas: 0n,
                paymaster: undefined,
                paymasterData: '0x',
                preVerificationGas: 0n,
                verificationGasLimit: 0n,
                factory,
                factoryData,
            },
            ...(await this.prepareBlankEnvelope(Number(chainId), provider)),
        };
    }
    async build4337Transaction(provider, envelope) {
        const status = await this.getStatus(provider);
        const updatedEnvelope = { ...envelope, configuration: status.configuration };
        const { weight, threshold } = Envelope.weightOf(updatedEnvelope);
        if (weight < threshold) {
            throw new Error('insufficient weight in envelope');
        }
        const signature = Envelope.encodeSignature(updatedEnvelope);
        const operation = Payload.to4337UserOperation(envelope.payload, this.address, Bytes.toHex(SequenceSignature.encodeSignature({
            ...signature,
            suffix: status.pendingUpdates.map(({ signature }) => signature),
        })));
        return {
            operation: UserOperation.toRpc(operation),
            entrypoint: envelope.payload.entrypoint,
        };
    }
    async prepareTransaction(provider, calls, options) {
        const space = options?.space ?? 0n;
        // If safe mode is set, then we check that the transaction
        // is not "dangerous", aka it does not have any delegate calls
        // or calls to the wallet contract itself
        if (!options?.unsafe) {
            for (const call of calls) {
                if (call.delegateCall) {
                    throw new Error('delegate calls are not allowed in safe mode');
                }
                if (Address.isEqual(call.to, this.address)) {
                    throw new Error('calls to the wallet contract itself are not allowed in safe mode');
                }
            }
        }
        const [chainId, nonce] = await Promise.all([
            provider.request({ method: 'eth_chainId' }),
            this.getNonce(provider, space),
        ]);
        // If the latest configuration does not match the onchain configuration
        // then we bundle the update into the transaction envelope
        if (!options?.noConfigUpdate) {
            const status = await this.getStatus(provider);
            if (status.imageHash !== status.onChainImageHash) {
                calls.push({
                    to: this.address,
                    value: 0n,
                    data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [status.imageHash]),
                    gasLimit: 0n,
                    delegateCall: false,
                    onlyFallback: false,
                    behaviorOnError: 'revert',
                });
            }
        }
        return {
            payload: {
                type: 'call',
                space,
                nonce,
                calls,
            },
            ...(await this.prepareBlankEnvelope(Number(chainId), provider)),
        };
    }
    async buildTransaction(provider, envelope) {
        const status = await this.getStatus(provider);
        const updatedEnvelope = { ...envelope, configuration: status.configuration };
        const { weight, threshold } = Envelope.weightOf(updatedEnvelope);
        if (weight < threshold) {
            throw new Error('insufficient weight in envelope');
        }
        const signature = Envelope.encodeSignature(updatedEnvelope);
        if (status.isDeployed) {
            return {
                to: this.address,
                data: AbiFunction.encodeData(Constants.EXECUTE, [
                    Bytes.toHex(Payload.encode(envelope.payload)),
                    Bytes.toHex(SequenceSignature.encodeSignature({
                        ...signature,
                        suffix: status.pendingUpdates.map(({ signature }) => signature),
                    })),
                ]),
            };
        }
        else {
            const deploy = await this.buildDeployTransaction();
            return {
                to: this.guest,
                data: Bytes.toHex(Payload.encode({
                    type: 'call',
                    space: 0n,
                    nonce: 0n,
                    calls: [
                        {
                            to: deploy.to,
                            value: 0n,
                            data: deploy.data,
                            gasLimit: 0n,
                            delegateCall: false,
                            onlyFallback: false,
                            behaviorOnError: 'revert',
                        },
                        {
                            to: this.address,
                            value: 0n,
                            data: AbiFunction.encodeData(Constants.EXECUTE, [
                                Bytes.toHex(Payload.encode(envelope.payload)),
                                Bytes.toHex(SequenceSignature.encodeSignature({
                                    ...signature,
                                    suffix: status.pendingUpdates.map(({ signature }) => signature),
                                })),
                            ]),
                            gasLimit: 0n,
                            delegateCall: false,
                            onlyFallback: false,
                            behaviorOnError: 'revert',
                        },
                    ],
                })),
            };
        }
    }
    async prepareMessageSignature(message, chainId) {
        let encodedMessage;
        if (typeof message !== 'string') {
            encodedMessage = TypedData.encode(message);
        }
        else {
            let hexMessage = Hex.validate(message) ? message : Hex.fromString(message);
            const messageSize = Hex.size(hexMessage);
            encodedMessage = Hex.concat(Hex.fromString(`${`\x19Ethereum Signed Message:\n${messageSize}`}`), hexMessage);
        }
        return {
            ...(await this.prepareBlankEnvelope(chainId)),
            payload: Payload.fromMessage(encodedMessage),
        };
    }
    async buildMessageSignature(envelope, provider) {
        const status = await this.getStatus(provider);
        const signature = Envelope.encodeSignature(envelope);
        if (!status.isDeployed) {
            const deployTransaction = await this.buildDeployTransaction();
            signature.erc6492 = { to: deployTransaction.to, data: Bytes.fromHex(deployTransaction.data) };
        }
        const encoded = SequenceSignature.encodeSignature({
            ...signature,
            suffix: status.pendingUpdates.map(({ signature }) => signature),
        });
        return encoded;
    }
    async prepareBlankEnvelope(chainId, provider) {
        const status = await this.getStatus(provider);
        return {
            wallet: this.address,
            chainId: chainId,
            configuration: status.configuration,
        };
    }
}

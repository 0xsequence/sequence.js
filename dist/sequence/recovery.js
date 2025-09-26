import { Envelope } from '@0xsequence/wallet-core';
import { Config, Constants, Extensions, GenericTree, Payload } from '@0xsequence/wallet-primitives';
import { Address, Provider, RpcTransport } from 'ox';
import { MnemonicHandler } from './handlers/mnemonic.js';
import { Actions } from './types/index.js';
import { Kinds } from './types/signer.js';
export class Recovery {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    initialize() {
        this.shared.modules.cron.registerJob('update-queued-recovery-payloads', 5 * 60 * 1000, // 5 minutes
        async () => {
            this.shared.modules.logger.log('Running job: update-queued-recovery-payloads');
            await this.updateQueuedPayloads();
        });
        this.shared.modules.logger.log('Recovery module initialized and job registered.');
    }
    async updateRecoveryModule(modules, transformer) {
        const ext = this.shared.sequence.extensions.recovery;
        const idx = modules.findIndex((m) => Address.isEqual(m.sapientLeaf.address, ext));
        if (idx === -1) {
            return;
        }
        const recoveryModule = modules[idx];
        if (!recoveryModule) {
            throw new Error('recovery-module-not-found');
        }
        const genericTree = await this.shared.sequence.stateProvider.getTree(recoveryModule.sapientLeaf.imageHash);
        if (!genericTree) {
            throw new Error('recovery-module-tree-not-found');
        }
        const tree = Extensions.Recovery.fromGenericTree(genericTree);
        const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(tree);
        if (!isComplete) {
            throw new Error('recovery-module-tree-incomplete');
        }
        const nextTree = Extensions.Recovery.fromRecoveryLeaves(transformer(leaves));
        const nextGeneric = Extensions.Recovery.toGenericTree(nextTree);
        await this.shared.sequence.stateProvider.saveTree(nextGeneric);
        if (!modules[idx]) {
            throw new Error('recovery-module-not-found-(unreachable)');
        }
        modules[idx].sapientLeaf.imageHash = GenericTree.hash(nextGeneric);
    }
    async initRecoveryModule(modules, address) {
        if (this.hasRecoveryModule(modules)) {
            throw new Error('recovery-module-already-initialized');
        }
        const recoveryTree = Extensions.Recovery.fromRecoveryLeaves([
            {
                type: 'leaf',
                signer: address,
                requiredDeltaTime: this.shared.sequence.defaultRecoverySettings.requiredDeltaTime,
                minTimestamp: this.shared.sequence.defaultRecoverySettings.minTimestamp,
            },
        ]);
        const recoveryGenericTree = Extensions.Recovery.toGenericTree(recoveryTree);
        await this.shared.sequence.stateProvider.saveTree(recoveryGenericTree);
        const recoveryImageHash = GenericTree.hash(recoveryGenericTree);
        modules.push({
            sapientLeaf: {
                type: 'sapient-signer',
                address: this.shared.sequence.extensions.recovery,
                weight: 255n,
                imageHash: recoveryImageHash,
            },
            weight: 255n,
        });
    }
    hasRecoveryModule(modules) {
        return modules.some((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.recovery));
    }
    async addRecoverySignerToModules(modules, address) {
        if (!this.hasRecoveryModule(modules)) {
            throw new Error('recovery-module-not-enabled');
        }
        await this.updateRecoveryModule(modules, (leaves) => {
            if (leaves.some((l) => Address.isEqual(l.signer, address))) {
                return leaves;
            }
            const filtered = leaves.filter((l) => !Address.isEqual(l.signer, Constants.ZeroAddress));
            return [
                ...filtered,
                {
                    type: 'leaf',
                    signer: address,
                    requiredDeltaTime: this.shared.sequence.defaultRecoverySettings.requiredDeltaTime,
                    minTimestamp: this.shared.sequence.defaultRecoverySettings.minTimestamp,
                },
            ];
        });
    }
    async removeRecoverySignerFromModules(modules, address) {
        if (!this.hasRecoveryModule(modules)) {
            throw new Error('recovery-module-not-enabled');
        }
        await this.updateRecoveryModule(modules, (leaves) => {
            const next = leaves.filter((l) => l.signer !== address);
            if (next.length === 0) {
                return [
                    {
                        type: 'leaf',
                        signer: Constants.ZeroAddress,
                        requiredDeltaTime: 0n,
                        minTimestamp: 0n,
                    },
                ];
            }
            return next;
        });
    }
    async addMnemonic(wallet, mnemonic) {
        const signer = MnemonicHandler.toSigner(mnemonic);
        if (!signer) {
            throw new Error('invalid-mnemonic');
        }
        await signer.witness(this.shared.sequence.stateProvider, wallet, {
            isForRecovery: true,
            signerKind: Kinds.LoginMnemonic,
        });
        return this.addSigner(wallet, signer.address);
    }
    async addSigner(wallet, address) {
        const { modules } = await this.shared.modules.wallets.getConfigurationParts(wallet);
        await this.addRecoverySignerToModules(modules, address);
        return this.shared.modules.wallets.requestConfigurationUpdate(wallet, {
            modules,
        }, Actions.AddRecoverySigner, 'wallet-webapp');
    }
    async removeSigner(wallet, address) {
        const { modules } = await this.shared.modules.wallets.getConfigurationParts(wallet);
        await this.removeRecoverySignerFromModules(modules, address);
        return this.shared.modules.wallets.requestConfigurationUpdate(wallet, { modules }, Actions.RemoveRecoverySigner, 'wallet-webapp');
    }
    async completeUpdate(requestId) {
        const request = await this.shared.modules.signatures.get(requestId);
        if (request.action !== 'add-recovery-signer' && request.action !== 'remove-recovery-signer') {
            throw new Error('invalid-recovery-update-action');
        }
        return this.shared.modules.wallets.completeConfigurationUpdate(requestId);
    }
    async getSigners(address) {
        const { raw } = await this.shared.modules.wallets.getConfiguration(address);
        const recoveryModule = raw.modules.find((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.recovery));
        if (!recoveryModule) {
            return undefined;
        }
        const recoveryGenericTree = await this.shared.sequence.stateProvider.getTree(recoveryModule.sapientLeaf.imageHash);
        if (!recoveryGenericTree) {
            throw new Error('recovery-module-tree-not-found');
        }
        const recoveryTree = Extensions.Recovery.fromGenericTree(recoveryGenericTree);
        const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(recoveryTree);
        if (!isComplete) {
            throw new Error('recovery-module-tree-incomplete');
        }
        const kos = await this.shared.modules.signers.resolveKinds(address, leaves.map((l) => l.signer));
        return leaves
            .filter((l) => !Address.isEqual(l.signer, Constants.ZeroAddress))
            .map((l) => ({
            address: l.signer,
            kind: kos.find((s) => Address.isEqual(s.address, l.signer))?.kind || 'unknown',
            isRecovery: true,
            minTimestamp: l.minTimestamp,
            requiredDeltaTime: l.requiredDeltaTime,
        }));
    }
    async queuePayload(wallet, chainId, payload) {
        const signers = await this.getSigners(wallet);
        if (!signers) {
            throw new Error('recovery-signers-not-found');
        }
        const recoveryPayload = Payload.toRecovery(payload);
        const simulatedTopology = Config.flatLeavesToTopology(signers.map((s) => ({
            type: 'signer',
            address: s.address,
            weight: 1n,
        })));
        // Save both versions of the payload in parallel
        await Promise.all([
            this.shared.sequence.stateProvider.savePayload(wallet, payload, chainId),
            this.shared.sequence.stateProvider.savePayload(wallet, recoveryPayload, chainId),
        ]);
        const requestId = await this.shared.modules.signatures.request({
            wallet,
            chainId,
            configuration: {
                threshold: 1n,
                checkpoint: 0n,
                topology: simulatedTopology,
            },
            payload: recoveryPayload,
        }, 'recovery');
        return requestId;
    }
    // TODO: Handle this transaction instead of just returning the to and data
    async completePayload(requestId) {
        const signature = await this.shared.modules.signatures.get(requestId);
        if (signature.action !== 'recovery' || !Payload.isRecovery(signature.envelope.payload)) {
            throw new Error('invalid-recovery-payload');
        }
        if (!Envelope.isSigned(signature.envelope)) {
            throw new Error('recovery-payload-not-signed');
        }
        const { weight, threshold } = Envelope.weightOf(signature.envelope);
        if (weight < threshold) {
            throw new Error('recovery-payload-insufficient-weight');
        }
        // Find any valid signature
        const validSignature = signature.envelope.signatures[0];
        if (Envelope.isSapientSignature(validSignature)) {
            throw new Error('recovery-payload-sapient-signatures-not-supported');
        }
        if (!validSignature) {
            throw new Error('recovery-payload-no-valid-signature');
        }
        const calldata = Extensions.Recovery.encodeCalldata(signature.wallet, signature.envelope.payload, validSignature.address, validSignature.signature);
        return {
            to: this.shared.sequence.extensions.recovery,
            data: calldata,
        };
    }
    async getQueuedRecoveryPayloads(wallet, chainId) {
        // If no wallet is provided, always use the database
        if (!wallet) {
            return this.shared.databases.recovery.list();
        }
        // If the wallet is logged in, then we can expect to have all the payloads in the database
        // because the cronjob keeps it updated
        if (await this.shared.modules.wallets.get(wallet)) {
            const all = await this.shared.databases.recovery.list();
            return all.filter((p) => Address.isEqual(p.wallet, wallet));
        }
        // If not, then we must fetch them from the chain
        return this.fetchQueuedPayloads(wallet, chainId);
    }
    onQueuedPayloadsUpdate(wallet, cb, trigger) {
        if (trigger) {
            this.getQueuedRecoveryPayloads(wallet).then(cb);
        }
        return this.shared.databases.recovery.addListener(() => {
            this.getQueuedRecoveryPayloads(wallet).then(cb);
        });
    }
    async updateQueuedPayloads() {
        const wallets = await this.shared.modules.wallets.list();
        for (const wallet of wallets) {
            const payloads = await this.fetchQueuedPayloads(wallet.address);
            for (const payload of payloads) {
                await this.shared.databases.recovery.set(payload);
            }
            // Delete any unseen queued payloads as they are no longer relevant
            const seenInThisRun = new Set(payloads.map((p) => p.id));
            const allQueuedPayloads = await this.shared.databases.recovery.list();
            for (const payload of allQueuedPayloads) {
                if (!seenInThisRun.has(payload.id)) {
                    await this.shared.databases.recovery.del(payload.id);
                }
            }
        }
    }
    async fetchQueuedPayloads(wallet, chainId) {
        // Create providers for each network
        const providers = this.shared.sequence.networks
            .filter((network) => (chainId ? network.chainId === chainId : true))
            .map((network) => ({
            chainId: network.chainId,
            provider: Provider.from(RpcTransport.fromHttp(network.rpcUrl)),
        }));
        // See if they have any recover signers
        const signers = await this.getSigners(wallet);
        if (!signers || signers.length === 0) {
            return [];
        }
        const payloads = [];
        for (const signer of signers) {
            for (const { chainId, provider } of providers) {
                const totalPayloads = await Extensions.Recovery.totalQueuedPayloads(provider, this.shared.sequence.extensions.recovery, wallet, signer.address);
                for (let i = 0n; i < totalPayloads; i++) {
                    const payloadHash = await Extensions.Recovery.queuedPayloadHashOf(provider, this.shared.sequence.extensions.recovery, wallet, signer.address, i);
                    const timestamp = await Extensions.Recovery.timestampForQueuedPayload(provider, this.shared.sequence.extensions.recovery, wallet, signer.address, payloadHash);
                    const payload = await this.shared.sequence.stateProvider.getPayload(payloadHash);
                    // If ready, we need to check if it was executed already
                    // for this, we check if the wallet nonce for the given space
                    // is greater than the nonce in the payload
                    if (timestamp < Date.now() / 1000 && payload && Payload.isCalls(payload.payload)) {
                        const nonce = await this.shared.modules.wallets.getNonce(chainId, wallet, payload.payload.space);
                        if (nonce > i) {
                            continue;
                        }
                    }
                    // The id is the index + signer address + chainId + wallet address
                    const id = `${i}-${signer.address}-${chainId}-${wallet}`;
                    // Create a new payload
                    const payloadEntry = {
                        id,
                        index: i,
                        recoveryModule: this.shared.sequence.extensions.recovery,
                        wallet: wallet,
                        signer: signer.address,
                        chainId,
                        startTimestamp: timestamp,
                        endTimestamp: timestamp + signer.requiredDeltaTime,
                        payloadHash,
                        payload: payload?.payload,
                    };
                    payloads.push(payloadEntry);
                }
            }
        }
        return payloads;
    }
    async encodeRecoverySignature(imageHash, signer) {
        const genericTree = await this.shared.sequence.stateProvider.getTree(imageHash);
        if (!genericTree) {
            throw new Error('recovery-module-tree-not-found');
        }
        const tree = Extensions.Recovery.fromGenericTree(genericTree);
        const allSigners = Extensions.Recovery.getRecoveryLeaves(tree).leaves.map((l) => l.signer);
        if (!allSigners.includes(signer)) {
            throw new Error('signer-not-found-in-recovery-module');
        }
        const trimmed = Extensions.Recovery.trimTopology(tree, signer);
        return Extensions.Recovery.encodeTopology(trimmed);
    }
}

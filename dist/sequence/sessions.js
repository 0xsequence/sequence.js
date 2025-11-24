import { Envelope } from '@0xsequence/wallet-core';
import { Config, GenericTree, Payload, SessionConfig, } from '@0xsequence/wallet-primitives';
import { Address, Bytes, Hash, Hex } from 'ox';
import { AuthCodePkceHandler } from './handlers/authcode-pkce.js';
import { IdentityHandler, identityTypeToHex } from './handlers/identity.js';
import { ManagerOptionsDefaults } from './manager.js';
import { Kinds } from './types/index.js';
import { Actions } from './types/signature-request.js';
export class Sessions {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    async getTopology(walletAddress, fixMissing = false) {
        const { loginTopology, devicesTopology, modules } = await this.shared.modules.wallets.getConfigurationParts(walletAddress);
        const managerModule = modules.find((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions));
        if (!managerModule) {
            if (fixMissing) {
                // Create the default session manager leaf
                const authorizedSigners = [...Config.topologyToFlatLeaves([devicesTopology, loginTopology])].filter(Config.isSignerLeaf);
                if (authorizedSigners.length === 0) {
                    throw new Error('No signer leaves found');
                }
                let sessionsTopology = SessionConfig.emptySessionsTopology(authorizedSigners[0].address);
                for (let i = 1; i < authorizedSigners.length; i++) {
                    sessionsTopology = SessionConfig.addIdentitySigner(sessionsTopology, authorizedSigners[i].address);
                }
                const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology);
                this.shared.sequence.stateProvider.saveTree(sessionsConfigTree);
                const imageHash = GenericTree.hash(sessionsConfigTree);
                const leaf = {
                    ...ManagerOptionsDefaults.defaultSessionsTopology,
                    address: this.shared.sequence.extensions.sessions,
                    imageHash,
                };
                modules.push({
                    sapientLeaf: leaf,
                    weight: 255n,
                });
                return SessionConfig.configurationTreeToSessionsTopology(sessionsConfigTree);
            }
            throw new Error('Session manager not found');
        }
        const imageHash = managerModule.sapientLeaf.imageHash;
        const tree = await this.shared.sequence.stateProvider.getTree(imageHash);
        if (!tree) {
            throw new Error('Session topology not found');
        }
        return SessionConfig.configurationTreeToSessionsTopology(tree);
    }
    async updateSessionModule(modules, transformer) {
        const ext = this.shared.sequence.extensions.sessions;
        const idx = modules.findIndex((m) => Address.isEqual(m.sapientLeaf.address, ext));
        if (idx === -1) {
            return;
        }
        const sessionModule = modules[idx];
        if (!sessionModule) {
            throw new Error('session-module-not-found');
        }
        const genericTree = await this.shared.sequence.stateProvider.getTree(sessionModule.sapientLeaf.imageHash);
        if (!genericTree) {
            throw new Error('session-module-tree-not-found');
        }
        const topology = SessionConfig.configurationTreeToSessionsTopology(genericTree);
        const nextTopology = transformer(topology);
        const nextTree = SessionConfig.sessionsTopologyToConfigurationTree(nextTopology);
        await this.shared.sequence.stateProvider.saveTree(nextTree);
        if (!modules[idx]) {
            throw new Error('session-module-not-found-(unreachable)');
        }
        modules[idx].sapientLeaf.imageHash = GenericTree.hash(nextTree);
    }
    hasSessionModule(modules) {
        return modules.some((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions));
    }
    async initSessionModule(modules, identitySigners, guardTopology) {
        if (this.hasSessionModule(modules)) {
            throw new Error('session-module-already-initialized');
        }
        if (identitySigners.length === 0) {
            throw new Error('No identity signers provided');
        }
        // Calculate image hash with the identity signers
        const sessionsTopology = SessionConfig.emptySessionsTopology(identitySigners);
        // Store this tree in the state provider
        const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology);
        this.shared.sequence.stateProvider.saveTree(sessionsConfigTree);
        // Prepare the configuration leaf
        const sessionsImageHash = GenericTree.hash(sessionsConfigTree);
        const signer = {
            ...ManagerOptionsDefaults.defaultSessionsTopology,
            address: this.shared.sequence.extensions.sessions,
            imageHash: sessionsImageHash,
        };
        modules.push({
            sapientLeaf: signer,
            weight: 255n,
            guardLeaf: guardTopology,
        });
    }
    async addIdentitySignerToModules(modules, address) {
        if (!this.hasSessionModule(modules)) {
            throw new Error('session-module-not-enabled');
        }
        await this.updateSessionModule(modules, (topology) => {
            const existingSigners = SessionConfig.getIdentitySigners(topology);
            if (existingSigners?.some((s) => Address.isEqual(s, address))) {
                return topology;
            }
            return SessionConfig.addIdentitySigner(topology, address);
        });
    }
    async removeIdentitySignerFromModules(modules, address) {
        if (!this.hasSessionModule(modules)) {
            throw new Error('session-module-not-enabled');
        }
        await this.updateSessionModule(modules, (topology) => {
            const newTopology = SessionConfig.removeIdentitySigner(topology, address);
            if (!newTopology) {
                // Can't remove the last identity signer
                throw new Error('Cannot remove the last identity signer');
            }
            return newTopology;
        });
    }
    async prepareAuthorizeImplicitSession(walletAddress, sessionAddress, args) {
        const topology = await this.getTopology(walletAddress);
        const identitySigners = SessionConfig.getIdentitySigners(topology);
        if (identitySigners.length === 0) {
            throw new Error('No identity signers found');
        }
        let handler;
        let identitySignerAddress;
        for (const identitySigner of identitySigners) {
            const identityKind = await this.shared.modules.signers.kindOf(walletAddress, identitySigner);
            if (!identityKind) {
                console.warn('No identity handler kind found for', identitySigner);
                continue;
            }
            if (identityKind === Kinds.LoginPasskey) {
                console.warn('Implicit sessions do not support passkeys', identitySigner);
                continue;
            }
            const iHandler = this.shared.handlers.get(identityKind);
            if (iHandler) {
                handler = iHandler;
                identitySignerAddress = identitySigner;
                break;
            }
        }
        if (!handler || !identitySignerAddress) {
            throw new Error('No identity handler or address found');
        }
        // Create the attestation to sign
        let identityType;
        let issuerHash = '0x';
        let audienceHash = '0x';
        if (handler instanceof IdentityHandler) {
            identityType = handler.identityType;
            if (handler instanceof AuthCodePkceHandler) {
                issuerHash = Hash.keccak256(Hex.fromString(handler.issuer));
                audienceHash = Hash.keccak256(Hex.fromString(handler.audience));
            }
        }
        const attestation = {
            approvedSigner: sessionAddress,
            identityType: Bytes.fromHex(identityTypeToHex(identityType), { size: 4 }),
            issuerHash: Bytes.fromHex(issuerHash, { size: 32 }),
            audienceHash: Bytes.fromHex(audienceHash, { size: 32 }),
            applicationData: Bytes.fromHex(args.applicationData ?? '0x'),
            authData: {
                redirectUrl: args.target,
                issuedAt: BigInt(Math.floor(Date.now() / 1000)),
            },
        };
        // Fake the configuration with the single required signer
        const configuration = {
            threshold: 1n,
            checkpoint: 0n,
            topology: {
                type: 'signer',
                address: identitySignerAddress,
                weight: 1n,
            },
        };
        const envelope = {
            payload: {
                type: 'session-implicit-authorize',
                sessionAddress,
                attestation,
            },
            wallet: walletAddress,
            chainId: 0,
            configuration,
        };
        // Request the signature from the identity handler
        return this.shared.modules.signatures.request(envelope, 'session-implicit-authorize', {
            origin: args.target,
        });
    }
    async completeAuthorizeImplicitSession(requestId) {
        // Get the updated signature request
        const signatureRequest = await this.shared.modules.signatures.get(requestId);
        if (signatureRequest.action !== 'session-implicit-authorize' ||
            !Payload.isSessionImplicitAuthorize(signatureRequest.envelope.payload)) {
            throw new Error('Invalid action');
        }
        if (!Envelope.isSigned(signatureRequest.envelope) || !Envelope.reachedThreshold(signatureRequest.envelope)) {
            throw new Error('Envelope not signed or threshold not reached');
        }
        // Find any valid signature
        const signature = signatureRequest.envelope.signatures[0];
        if (!signature || !Envelope.isSignature(signature)) {
            throw new Error('No valid signature found');
        }
        if (signature.signature.type !== 'hash') {
            // Should never happen
            throw new Error('Unsupported signature type');
        }
        await this.shared.modules.signatures.complete(requestId);
        return {
            attestation: signatureRequest.envelope.payload.attestation,
            signature: signature.signature,
        };
    }
    async addExplicitSession(walletAddress, explicitSession, origin) {
        const topology = await this.getTopology(walletAddress, true);
        const newTopology = SessionConfig.addExplicitSession(topology, {
            ...explicitSession,
            signer: explicitSession.sessionAddress,
        });
        return this.prepareSessionUpdate(walletAddress, newTopology, origin);
    }
    async modifyExplicitSession(walletAddress, explicitSession, origin) {
        // This will add the session manager if it's missing
        const topology = await this.getTopology(walletAddress, true);
        const intermediateTopology = SessionConfig.removeExplicitSession(topology, explicitSession.sessionAddress);
        if (!intermediateTopology) {
            throw new Error('Incomplete session topology');
        }
        const newTopology = SessionConfig.addExplicitSession(intermediateTopology, {
            ...explicitSession,
            signer: explicitSession.sessionAddress,
        });
        return this.prepareSessionUpdate(walletAddress, newTopology, origin);
    }
    async removeExplicitSession(walletAddress, sessionAddress, origin) {
        const topology = await this.getTopology(walletAddress);
        const newTopology = SessionConfig.removeExplicitSession(topology, sessionAddress);
        if (!newTopology) {
            throw new Error('Incomplete session topology');
        }
        return this.prepareSessionUpdate(walletAddress, newTopology, origin);
    }
    async addBlacklistAddress(walletAddress, address, origin) {
        const topology = await this.getTopology(walletAddress, true);
        const newTopology = SessionConfig.addToImplicitBlacklist(topology, address);
        return this.prepareSessionUpdate(walletAddress, newTopology, origin);
    }
    async removeBlacklistAddress(walletAddress, address, origin) {
        const topology = await this.getTopology(walletAddress);
        const newTopology = SessionConfig.removeFromImplicitBlacklist(topology, address);
        return this.prepareSessionUpdate(walletAddress, newTopology, origin);
    }
    async prepareSessionUpdate(walletAddress, topology, origin = 'wallet-webapp') {
        // Store the new configuration
        const tree = SessionConfig.sessionsTopologyToConfigurationTree(topology);
        await this.shared.sequence.stateProvider.saveTree(tree);
        const newImageHash = GenericTree.hash(tree);
        // Find the session manager in the old configuration
        const { modules } = await this.shared.modules.wallets.getConfigurationParts(walletAddress);
        const managerModule = modules.find((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions));
        if (!managerModule) {
            // Missing. Add it
            modules.push({
                sapientLeaf: {
                    ...ManagerOptionsDefaults.defaultSessionsTopology,
                    address: this.shared.sequence.extensions.sessions,
                    imageHash: newImageHash,
                },
                weight: 255n,
            });
        }
        else {
            // Update the configuration to use the new session manager image hash
            managerModule.sapientLeaf.imageHash = newImageHash;
        }
        return this.shared.modules.wallets.requestConfigurationUpdate(walletAddress, {
            modules,
        }, Actions.SessionUpdate, origin);
    }
    async complete(requestId) {
        const sigRequest = await this.shared.modules.signatures.get(requestId);
        if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(sigRequest.envelope.payload)) {
            throw new Error('Invalid action');
        }
        return this.shared.modules.wallets.completeConfigurationUpdate(requestId);
    }
}

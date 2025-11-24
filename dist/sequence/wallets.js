import { Wallet as CoreWallet, Envelope, Signers, State } from '@0xsequence/wallet-core';
import { Config, Constants, Payload } from '@0xsequence/wallet-primitives';
import { Address, Provider, RpcTransport } from 'ox';
import { MnemonicHandler } from './handlers/mnemonic.js';
import { Kinds } from './types/signer.js';
export function isLoginToWalletArgs(args) {
    return 'wallet' in args;
}
export function isLoginToMnemonicArgs(args) {
    return 'kind' in args && args.kind === 'mnemonic';
}
export function isLoginToPasskeyArgs(args) {
    return 'kind' in args && args.kind === 'passkey';
}
export function isAuthCodeArgs(args) {
    return 'kind' in args && (args.kind === 'google-pkce' || args.kind === 'apple');
}
function buildCappedTree(members) {
    const loginMemberWeight = 1n;
    if (members.length === 0) {
        // We need to maintain the general structure of the tree, so we can't have an empty node here
        // instead, we add a dummy signer with weight 0
        return {
            type: 'signer',
            address: Constants.ZeroAddress,
            weight: 0n,
        };
    }
    if (members.length === 1) {
        if (members[0].imageHash) {
            return {
                type: 'sapient-signer',
                address: members[0].address,
                imageHash: members[0].imageHash,
                weight: loginMemberWeight,
            };
        }
        else {
            return {
                type: 'signer',
                address: members[0].address,
                weight: loginMemberWeight,
            };
        }
    }
    return {
        type: 'nested',
        weight: loginMemberWeight,
        threshold: 1n,
        tree: Config.flatLeavesToTopology(members.map((member) => member.imageHash
            ? {
                type: 'sapient-signer',
                address: member.address,
                imageHash: member.imageHash,
                weight: 1n,
            }
            : {
                type: 'signer',
                address: member.address,
                weight: 1n,
            })),
    };
}
function buildCappedTreeFromTopology(weight, topology) {
    // We may optimize this for some topology types
    // but it is not worth it, because the topology
    // that we will use for prod won't be optimizable
    return {
        type: 'nested',
        weight: weight,
        threshold: weight,
        tree: topology,
    };
}
function toConfig(checkpoint, loginTopology, devicesTopology, modules, guardTopology) {
    if (!guardTopology) {
        return {
            checkpoint: checkpoint,
            threshold: 1n,
            topology: [[loginTopology, devicesTopology], toModulesTopology(modules)],
        };
    }
    else {
        return {
            checkpoint: checkpoint,
            threshold: 2n,
            topology: [[[loginTopology, devicesTopology], guardTopology], toModulesTopology(modules)],
        };
    }
}
function toModulesTopology(modules) {
    // We always include a modules topology, even if there are no modules
    // in that case we just add a signer with address 0 and no weight
    if (modules.length === 0) {
        return {
            type: 'signer',
            address: Constants.ZeroAddress,
            weight: 0n,
        };
    }
    const leaves = modules.map((module) => {
        if (module.guardLeaf) {
            return {
                type: 'nested',
                weight: module.weight,
                threshold: module.sapientLeaf.weight + Config.getWeight(module.guardLeaf, () => true).maxWeight,
                tree: [module.sapientLeaf, module.guardLeaf],
            };
        }
        else {
            return module.sapientLeaf;
        }
    });
    return Config.flatLeavesToTopology(leaves);
}
function fromModulesTopology(topology) {
    let modules = [];
    if (Config.isNode(topology)) {
        modules = [...fromModulesTopology(topology[0]), ...fromModulesTopology(topology[1])];
    }
    else if (Config.isSapientSignerLeaf(topology)) {
        modules.push({
            sapientLeaf: topology,
            weight: topology.weight,
        });
    }
    else if (Config.isNestedLeaf(topology) &&
        Config.isNode(topology.tree) &&
        Config.isSapientSignerLeaf(topology.tree[0])) {
        modules.push({
            sapientLeaf: topology.tree[0],
            weight: topology.weight,
            guardLeaf: topology.tree[1],
        });
    }
    else if (Config.isSignerLeaf(topology)) {
        // Ignore non-sapient signers, as they are not modules
        return [];
    }
    else {
        throw new Error('unknown-modules-topology-format');
    }
    return modules;
}
function fromConfig(config) {
    if (config.threshold === 1n) {
        if (Config.isNode(config.topology) && Config.isNode(config.topology[0])) {
            return {
                loginTopology: config.topology[0][0],
                devicesTopology: config.topology[0][1],
                modules: fromModulesTopology(config.topology[1]),
            };
        }
        else {
            throw new Error('unknown-config-format');
        }
    }
    else if (config.threshold === 2n) {
        if (Config.isNode(config.topology) &&
            Config.isNode(config.topology[0]) &&
            Config.isNode(config.topology[0][0]) &&
            Config.isTopology(config.topology[0][1])) {
            return {
                loginTopology: config.topology[0][0][0],
                devicesTopology: config.topology[0][0][1],
                guardTopology: config.topology[0][1],
                modules: fromModulesTopology(config.topology[1]),
            };
        }
        else {
            throw new Error('unknown-config-format');
        }
    }
    throw new Error('unknown-config-format');
}
export class Wallets {
    shared;
    walletSelectionUiHandler = null;
    pendingMnemonicOrPasskeyLogin;
    constructor(shared) {
        this.shared = shared;
    }
    async has(wallet) {
        return this.get(wallet).then((r) => r !== undefined);
    }
    async get(walletAddress) {
        // Fetch the checksummed version first, if it does not exist, try the lowercase version
        const wallet = await this.shared.databases.manager.get(Address.checksum(walletAddress));
        if (wallet) {
            return wallet;
        }
        return this.shared.databases.manager.get(walletAddress.toLowerCase());
    }
    async list() {
        return this.shared.databases.manager.list();
    }
    async listDevices(wallet) {
        const walletEntry = await this.get(wallet);
        if (!walletEntry) {
            throw new Error('wallet-not-found');
        }
        const localDeviceAddress = walletEntry.device;
        const { devices: deviceSigners } = await this.getConfiguration(wallet);
        return deviceSigners.map((signer) => ({
            address: signer.address,
            isLocal: Address.isEqual(signer.address, localDeviceAddress),
        }));
    }
    registerWalletSelector(handler) {
        if (this.walletSelectionUiHandler) {
            throw new Error('wallet-selector-already-registered');
        }
        this.walletSelectionUiHandler = handler;
        return () => {
            this.unregisterWalletSelector(handler);
        };
    }
    unregisterWalletSelector(handler) {
        if (handler && this.walletSelectionUiHandler !== handler) {
            throw new Error('wallet-selector-not-registered');
        }
        this.walletSelectionUiHandler = null;
    }
    onWalletsUpdate(cb, trigger) {
        const undo = this.shared.databases.manager.addListener(() => {
            this.list().then((wallets) => {
                cb(wallets);
            });
        });
        if (trigger) {
            this.list().then((wallets) => {
                cb(wallets);
            });
        }
        return undo;
    }
    async prepareSignUp(args) {
        switch (args.kind) {
            case 'passkey':
                const passkeySigner = await Signers.Passkey.Passkey.create(this.shared.sequence.extensions, {
                    stateProvider: this.shared.sequence.stateProvider,
                    credentialName: args.name,
                });
                this.shared.modules.logger.log('Created new passkey signer:', passkeySigner.address);
                return {
                    signer: passkeySigner,
                    extra: {
                        signerKind: Kinds.LoginPasskey,
                    },
                };
            case 'mnemonic':
                const mnemonicSigner = MnemonicHandler.toSigner(args.mnemonic);
                if (!mnemonicSigner) {
                    throw new Error('invalid-mnemonic');
                }
                this.shared.modules.logger.log('Created new mnemonic signer:', mnemonicSigner.address);
                return {
                    signer: mnemonicSigner,
                    extra: {
                        signerKind: Kinds.LoginMnemonic,
                    },
                };
            case 'email-otp': {
                const handler = this.shared.handlers.get(Kinds.LoginEmailOtp);
                if (!handler) {
                    throw new Error('email-otp-handler-not-registered');
                }
                const { signer: otpSigner, email: returnedEmail } = await handler.getSigner(args.email);
                this.shared.modules.logger.log('Created new email otp signer:', otpSigner.address, 'Email:', returnedEmail);
                return {
                    signer: otpSigner,
                    extra: {
                        signerKind: Kinds.LoginEmailOtp,
                    },
                    loginEmail: returnedEmail,
                };
            }
            case 'google-pkce':
            case 'apple': {
                const handler = this.shared.handlers.get('login-' + args.kind);
                if (!handler) {
                    throw new Error('handler-not-registered');
                }
                const [signer, metadata] = await handler.completeAuth(args.commitment, args.code);
                const loginEmail = metadata.email;
                this.shared.modules.logger.log('Created new auth code pkce signer:', signer.address);
                return {
                    signer,
                    extra: {
                        signerKind: 'login-' + args.kind,
                    },
                    loginEmail,
                };
            }
        }
    }
    async startSignUpWithRedirect(args) {
        const handler = this.shared.handlers.get('login-' + args.kind);
        if (!handler) {
            throw new Error('handler-not-registered');
        }
        return handler.commitAuth(args.target, true);
    }
    async completeRedirect(args) {
        const commitment = await this.shared.databases.authCommitments.get(args.state);
        if (!commitment) {
            throw new Error('invalid-state');
        }
        // commitment.isSignUp and signUp also mean 'signIn' from wallet's perspective
        if (commitment.isSignUp) {
            await this.signUp({
                kind: commitment.kind,
                commitment,
                code: args.code,
                noGuard: args.noGuard,
                target: commitment.target,
                isRedirect: true,
                use4337: args.use4337,
            });
        }
        else {
            const handler = this.shared.handlers.get('login-' + commitment.kind);
            if (!handler) {
                throw new Error('handler-not-registered');
            }
            await handler.completeAuth(commitment, args.code);
        }
        if (!commitment.target) {
            throw new Error('invalid-state');
        }
        return commitment.target;
    }
    async signUp(args) {
        const loginSigner = await this.prepareSignUp(args);
        args.onStatusChange?.({ type: 'login-signer-created', address: await loginSigner.signer.address });
        // If there is an existing wallet callback, we check if any wallet already exist for this login signer
        if (this.walletSelectionUiHandler) {
            const existingWallets = await State.getWalletsFor(this.shared.sequence.stateProvider, loginSigner.signer);
            if (existingWallets.length > 0) {
                for (const wallet of existingWallets) {
                    const preliminaryEntry = {
                        address: wallet.wallet,
                        status: 'logging-in',
                        loginEmail: loginSigner.loginEmail,
                        loginType: loginSigner.extra.signerKind,
                        loginDate: new Date().toISOString(),
                        device: '',
                        useGuard: false,
                    };
                    await this.shared.databases.manager.set(preliminaryEntry);
                }
                const result = await this.walletSelectionUiHandler({
                    existingWallets: existingWallets.map((w) => w.wallet),
                    signerAddress: await loginSigner.signer.address,
                    context: isAuthCodeArgs(args) ? { isRedirect: args.isRedirect, target: args.target } : { isRedirect: false },
                });
                if (result === 'abort-signup') {
                    for (const wallet of existingWallets) {
                        const finalEntry = await this.shared.databases.manager.get(wallet.wallet);
                        if (finalEntry && !finalEntry.device) {
                            await this.shared.databases.manager.del(wallet.wallet);
                        }
                    }
                    args.onStatusChange?.({ type: 'signup-aborted' });
                    // Abort the signup process
                    return undefined;
                }
                if (result === 'create-new') {
                    for (const wallet of existingWallets) {
                        await this.shared.databases.manager.del(wallet.wallet);
                    }
                    // Continue with the signup process
                }
                else {
                    throw new Error('invalid-result-from-wallet-selector');
                }
            }
        }
        else {
            console.warn('No wallet selector registered, creating a new wallet');
        }
        // Create the first session
        const device = await this.shared.modules.devices.create();
        args.onStatusChange?.({ type: 'device-signer-created', address: device.address });
        if (!args.noGuard && !this.shared.sequence.defaultGuardTopology) {
            throw new Error('guard is required for signup');
        }
        // Build the login tree
        const loginSignerAddress = await loginSigner.signer.address;
        const loginTopology = buildCappedTree([
            {
                address: loginSignerAddress,
                imageHash: Signers.isSapientSigner(loginSigner.signer) ? await loginSigner.signer.imageHash : undefined,
            },
        ]);
        const devicesTopology = buildCappedTree([{ address: device.address }]);
        const walletGuardTopology = args.noGuard ? undefined : this.shared.modules.guards.topology('wallet');
        const sessionsGuardTopology = args.noGuard ? undefined : this.shared.modules.guards.topology('sessions');
        // Add modules
        let modules = [];
        if (!args.noSessionManager) {
            const identitySigners = [device.address];
            if (!Signers.isSapientSigner(loginSigner.signer)) {
                // Add non sapient login signer to the identity signers
                identitySigners.unshift(loginSignerAddress);
            }
            await this.shared.modules.sessions.initSessionModule(modules, identitySigners, sessionsGuardTopology);
        }
        if (!args.noRecovery) {
            await this.shared.modules.recovery.initRecoveryModule(modules, device.address);
        }
        // Create initial configuration
        const initialConfiguration = toConfig(0n, loginTopology, devicesTopology, modules, walletGuardTopology);
        console.log('initialConfiguration', initialConfiguration);
        // Create wallet
        const context = args.use4337 ? this.shared.sequence.context4337 : this.shared.sequence.context;
        const wallet = await CoreWallet.fromConfiguration(initialConfiguration, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
            context,
        });
        args.onStatusChange?.({ type: 'wallet-created', address: wallet.address });
        this.shared.modules.logger.log('Created new sequence wallet:', wallet.address);
        // Sign witness using device signer
        await this.shared.modules.devices.witness(device.address, wallet.address);
        // Sign witness using the passkey signer
        await loginSigner.signer.witness(this.shared.sequence.stateProvider, wallet.address, loginSigner.extra);
        // Save entry in the manager db
        const newWalletEntry = {
            address: wallet.address,
            status: 'ready',
            loginDate: new Date().toISOString(),
            device: device.address,
            loginType: loginSigner.extra.signerKind,
            useGuard: !args.noGuard,
            loginEmail: loginSigner.loginEmail,
        };
        try {
            await this.shared.databases.manager.set(newWalletEntry);
        }
        catch (error) {
            console.error('[Wallets/signUp] Error saving new wallet entry:', error, 'Entry was:', newWalletEntry);
            // Re-throw the error if you want the operation to fail loudly, or handle it
            throw error;
        }
        // Store passkey credential ID mapping if this is a passkey signup
        if (args.kind === 'passkey' && loginSigner.signer instanceof Signers.Passkey.Passkey) {
            try {
                await this.shared.databases.passkeyCredentials.saveCredential(loginSigner.signer.credentialId, loginSigner.signer.publicKey, wallet.address);
                this.shared.modules.logger.log('Stored passkey credential mapping for wallet:', wallet.address);
            }
            catch (error) {
                console.error('[Wallets/signUp] Error saving passkey mapping:', error);
                // Don't throw the error as this is not critical to the signup process
            }
        }
        args.onStatusChange?.({ type: 'signup-completed' });
        return wallet.address;
    }
    async getConfigurationParts(address) {
        const wallet = new CoreWallet(address, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const status = await wallet.getStatus();
        return fromConfig(status.configuration);
    }
    async requestConfigurationUpdate(address, changes, action, origin) {
        const wallet = new CoreWallet(address, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const status = await wallet.getStatus();
        const { loginTopology, devicesTopology, modules, guardTopology } = fromConfig(status.configuration);
        const nextLoginTopology = changes.loginTopology ?? loginTopology;
        const nextDevicesTopology = changes.devicesTopology ?? devicesTopology;
        const nextModules = changes.modules ?? modules;
        const nextGuardTopology = changes.guardTopology ?? guardTopology;
        const envelope = await wallet.prepareUpdate(toConfig(status.configuration.checkpoint + 1n, nextLoginTopology, nextDevicesTopology, nextModules, nextGuardTopology));
        const requestId = await this.shared.modules.signatures.request(envelope, action, {
            origin,
        });
        return requestId;
    }
    async completeConfigurationUpdate(requestId) {
        const request = await this.shared.modules.signatures.get(requestId);
        if (!Payload.isConfigUpdate(request.envelope.payload)) {
            throw new Error('invalid-request-payload');
        }
        if (!Envelope.reachedThreshold(request.envelope)) {
            throw new Error('insufficient-weight');
        }
        const wallet = new CoreWallet(request.wallet, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        await wallet.submitUpdate(request.envelope);
        await this.shared.modules.signatures.complete(requestId);
    }
    async login(args) {
        if (isLoginToWalletArgs(args)) {
            try {
                const existingWallet = await this.get(args.wallet);
                if (existingWallet?.status === 'ready') {
                    throw new Error('wallet-already-logged-in');
                }
                const device = await this.shared.modules.devices.create();
                const { devicesTopology, modules, guardTopology } = await this.getConfigurationParts(args.wallet);
                // Witness the wallet
                await this.shared.modules.devices.witness(device.address, args.wallet);
                // Add device to devices topology
                const prevDevices = Config.getSigners(devicesTopology);
                if (prevDevices.sapientSigners.length > 0) {
                    throw new Error('found-sapient-signer-in-devices-topology');
                }
                if (!prevDevices.isComplete) {
                    throw new Error('devices-topology-incomplete');
                }
                const nextDevicesTopology = buildCappedTree([
                    ...prevDevices.signers.filter((x) => x !== Constants.ZeroAddress).map((x) => ({ address: x })),
                    ...prevDevices.sapientSigners.map((x) => ({ address: x.address, imageHash: x.imageHash })),
                    { address: device.address },
                ]);
                if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
                    await this.shared.modules.recovery.addRecoverySignerToModules(modules, device.address);
                }
                if (this.shared.modules.sessions.hasSessionModule(modules)) {
                    await this.shared.modules.sessions.addIdentitySignerToModules(modules, device.address);
                }
                const walletEntryToUpdate = {
                    ...existingWallet,
                    address: args.wallet,
                    status: 'logging-in',
                    loginDate: new Date().toISOString(),
                    device: device.address,
                    loginType: existingWallet?.loginType || this.pendingMnemonicOrPasskeyLogin || 'wallet',
                    loginEmail: existingWallet?.loginEmail,
                    useGuard: guardTopology !== undefined,
                };
                await this.shared.databases.manager.set(walletEntryToUpdate);
                const requestId = await this.requestConfigurationUpdate(args.wallet, {
                    devicesTopology: nextDevicesTopology,
                    modules,
                }, 'login', 'wallet-webapp');
                this.shared.modules.signatures.onCancel(requestId, async (request) => {
                    this.shared.modules.logger.log('Login cancelled', request);
                    await this.shared.databases.manager.del(args.wallet);
                });
                return requestId;
            }
            catch (error) {
                throw error;
            }
            finally {
                this.pendingMnemonicOrPasskeyLogin = undefined;
            }
        }
        if (isLoginToMnemonicArgs(args)) {
            const mnemonicSigner = MnemonicHandler.toSigner(args.mnemonic);
            if (!mnemonicSigner) {
                throw new Error('invalid-mnemonic');
            }
            const wallets = await State.getWalletsFor(this.shared.sequence.stateProvider, mnemonicSigner);
            if (wallets.length === 0) {
                throw new Error('no-wallets-found');
            }
            const wallet = await args.selectWallet(wallets.map((w) => w.wallet));
            if (!wallets.some((w) => Address.isEqual(w.wallet, wallet))) {
                throw new Error('wallet-not-found');
            }
            // Ready the signer on the handler so it can be used to complete the login configuration update
            const mnemonicHandler = this.shared.handlers.get(Kinds.LoginMnemonic);
            mnemonicHandler.addReadySigner(mnemonicSigner);
            this.pendingMnemonicOrPasskeyLogin = Kinds.LoginMnemonic;
            return this.login({ wallet });
        }
        if (isLoginToPasskeyArgs(args)) {
            let passkeySigner;
            if (args.credentialId) {
                // Application-controlled login: use the provided credentialId
                this.shared.modules.logger.log('Using provided credentialId for passkey login:', args.credentialId);
                const credential = await this.shared.databases.passkeyCredentials.getByCredentialId(args.credentialId);
                if (!credential) {
                    throw new Error('credential-not-found');
                }
                // Create passkey signer from stored credential
                passkeySigner = new Signers.Passkey.Passkey({
                    credentialId: credential.credentialId,
                    publicKey: credential.publicKey,
                    extensions: this.shared.sequence.extensions,
                    embedMetadata: false,
                    metadata: { credentialId: credential.credentialId },
                });
            }
            else {
                // Default discovery behavior: use WebAuthn discovery
                this.shared.modules.logger.log('No credentialId provided, using discovery method');
                const foundPasskeySigner = await Signers.Passkey.Passkey.find(this.shared.sequence.stateProvider, this.shared.sequence.extensions);
                if (!foundPasskeySigner) {
                    throw new Error('no-passkey-found');
                }
                passkeySigner = foundPasskeySigner;
            }
            const wallets = await State.getWalletsFor(this.shared.sequence.stateProvider, passkeySigner);
            if (wallets.length === 0) {
                throw new Error('no-wallets-found');
            }
            const wallet = await args.selectWallet(wallets.map((w) => w.wallet));
            if (!wallets.some((w) => Address.isEqual(w.wallet, wallet))) {
                throw new Error('wallet-not-found');
            }
            // Store discovered credential
            try {
                const existingCredential = await this.shared.databases.passkeyCredentials.getByCredentialId(passkeySigner.credentialId);
                if (!existingCredential) {
                    await this.shared.databases.passkeyCredentials.saveCredential(passkeySigner.credentialId, passkeySigner.publicKey, wallet);
                }
                else {
                    await this.shared.databases.passkeyCredentials.updateCredential(passkeySigner.credentialId, {
                        lastLoginAt: new Date().toISOString(),
                        walletAddress: wallet,
                    });
                }
            }
            catch (error) {
                // Don't fail login if credential storage fails
                this.shared.modules.logger.log('Failed to store discovered passkey credential:', error);
            }
            // Store the passkey signer for later use during signing
            const passkeysHandler = this.shared.handlers.get(Kinds.LoginPasskey);
            passkeysHandler.addReadySigner(passkeySigner);
            this.pendingMnemonicOrPasskeyLogin = Kinds.LoginPasskey;
            return this.login({ wallet });
        }
        throw new Error('invalid-login-args');
    }
    async completeLogin(requestId) {
        const request = await this.shared.modules.signatures.get(requestId);
        const walletEntry = await this.shared.databases.manager.get(request.wallet);
        if (!walletEntry) {
            throw new Error('login-for-wallet-not-found');
        }
        await this.completeConfigurationUpdate(requestId);
        await this.shared.databases.manager.set({
            ...walletEntry,
            status: 'ready',
            loginDate: new Date().toISOString(),
        });
    }
    async logout(wallet, options) {
        const walletEntry = await this.shared.databases.manager.get(wallet);
        if (!walletEntry) {
            throw new Error('wallet-not-found');
        }
        if (options?.skipRemoveDevice) {
            await Promise.all([
                this.shared.databases.manager.del(wallet),
                this.shared.modules.devices.remove(walletEntry.device),
            ]);
            return undefined;
        }
        // Prevent starting logout if already logging out or not ready
        if (walletEntry.status !== 'ready') {
            console.warn(`Logout called on wallet ${wallet} with status ${walletEntry.status}. Aborting.`);
            throw new Error(`Wallet is not in 'ready' state for logout (current: ${walletEntry.status})`);
        }
        const device = await this.shared.modules.devices.get(walletEntry.device);
        if (!device) {
            throw new Error('device-not-found');
        }
        const requestId = await this._prepareDeviceRemovalUpdate(wallet, device.address, 'logout');
        await this.shared.databases.manager.set({ ...walletEntry, status: 'logging-out' });
        return requestId;
    }
    async remoteLogout(wallet, deviceAddress) {
        const walletEntry = await this.get(wallet);
        if (!walletEntry) {
            throw new Error('wallet-not-found');
        }
        if (Address.isEqual(walletEntry.device, deviceAddress)) {
            throw new Error('cannot-remote-logout-from-local-device');
        }
        const requestId = await this._prepareDeviceRemovalUpdate(wallet, deviceAddress, 'remote-logout');
        return requestId;
    }
    async completeLogout(requestId, options) {
        const request = await this.shared.modules.signatures.get(requestId);
        const walletEntry = await this.shared.databases.manager.get(request.wallet);
        if (!walletEntry) {
            throw new Error('wallet-not-found');
        }
        // Wallet entry should ideally be 'logging-out' here, but we proceed regardless
        if (walletEntry.status !== 'logging-out') {
            this.shared.modules.logger.log(`Warning: Wallet ${request.wallet} status was ${walletEntry.status} during completeLogout.`);
        }
        await this.completeConfigurationUpdate(requestId);
        await this.shared.databases.manager.del(request.wallet);
        await this.shared.modules.devices.remove(walletEntry.device);
    }
    async getConfiguration(wallet) {
        const walletObject = new CoreWallet(wallet, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const status = await walletObject.getStatus();
        const raw = fromConfig(status.configuration);
        const deviceSigners = Config.getSigners(raw.devicesTopology);
        const loginSigners = Config.getSigners(raw.loginTopology);
        const walletGuardSigners = raw.guardTopology ? Config.getSigners(raw.guardTopology) : undefined;
        const moduleGuards = (await Promise.all(raw.modules
            .filter((m) => m.guardLeaf)
            .map((m) => ({ moduleAddress: m.sapientLeaf.address, guardSigners: Config.getSigners(m.guardLeaf).signers }))
            .filter(({ guardSigners }) => guardSigners && guardSigners.length > 0)
            .map(async ({ moduleAddress, guardSigners }) => ({
            moduleAddress,
            guardSigners: await this.shared.modules.signers.resolveKinds(wallet, guardSigners),
        }))))
            .filter(({ guardSigners }) => guardSigners && guardSigners.length > 0)
            .map(({ moduleAddress, guardSigners }) => [moduleAddress, guardSigners[0]]);
        return {
            devices: await this.shared.modules.signers.resolveKinds(wallet, [
                ...deviceSigners.signers,
                ...deviceSigners.sapientSigners,
            ]),
            login: await this.shared.modules.signers.resolveKinds(wallet, [
                ...loginSigners.signers,
                ...loginSigners.sapientSigners,
            ]),
            walletGuard: walletGuardSigners && walletGuardSigners.signers.length > 0
                ? (await this.shared.modules.signers.resolveKinds(wallet, walletGuardSigners.signers))[0]
                : undefined,
            moduleGuards: new Map(moduleGuards),
            raw,
        };
    }
    async getNonce(chainId, address, space) {
        const wallet = new CoreWallet(address, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const network = this.shared.sequence.networks.find((n) => n.chainId === chainId);
        if (!network) {
            throw new Error('network-not-found');
        }
        const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl));
        return wallet.getNonce(provider, space);
    }
    async getOnchainConfiguration(wallet, chainId) {
        const walletObject = new CoreWallet(wallet, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const network = this.shared.sequence.networks.find((n) => n.chainId === chainId);
        if (!network) {
            throw new Error('network-not-found');
        }
        const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl));
        const status = await walletObject.getStatus(provider);
        const onchainConfiguration = await this.shared.sequence.stateProvider.getConfiguration(status.onChainImageHash);
        if (!onchainConfiguration) {
            throw new Error('onchain-configuration-not-found');
        }
        const raw = fromConfig(status.configuration);
        const deviceSigners = Config.getSigners(raw.devicesTopology);
        const loginSigners = Config.getSigners(raw.loginTopology);
        const guardSigners = raw.guardTopology ? Config.getSigners(raw.guardTopology) : undefined;
        return {
            devices: await this.shared.modules.signers.resolveKinds(wallet, [
                ...deviceSigners.signers,
                ...deviceSigners.sapientSigners,
            ]),
            login: await this.shared.modules.signers.resolveKinds(wallet, [
                ...loginSigners.signers,
                ...loginSigners.sapientSigners,
            ]),
            guard: guardSigners
                ? await this.shared.modules.signers.resolveKinds(wallet, [
                    ...guardSigners.signers,
                    ...guardSigners.sapientSigners,
                ])
                : [],
            raw,
        };
    }
    async isUpdatedOnchain(wallet, chainId) {
        const walletObject = new CoreWallet(wallet, {
            stateProvider: this.shared.sequence.stateProvider,
            guest: this.shared.sequence.guest,
        });
        const network = this.shared.sequence.networks.find((n) => n.chainId === chainId);
        if (!network) {
            throw new Error('network-not-found');
        }
        const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl));
        const onchainStatus = await walletObject.getStatus(provider);
        return onchainStatus.imageHash === onchainStatus.onChainImageHash;
    }
    async _prepareDeviceRemovalUpdate(wallet, deviceToRemove, action) {
        const { devicesTopology, modules } = await this.getConfigurationParts(wallet);
        // The result of this entire inner block is a clean, simple list of the remaining devices, ready to be rebuilt.
        const nextDevicesTopology = buildCappedTree([
            ...Config.getSigners(devicesTopology)
                .signers.filter((x) => x !== Constants.ZeroAddress && !Address.isEqual(x, deviceToRemove))
                .map((x) => ({ address: x })),
            ...Config.getSigners(devicesTopology).sapientSigners,
        ]);
        // Remove the device from the recovery module's topology as well.
        if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
            await this.shared.modules.recovery.removeRecoverySignerFromModules(modules, deviceToRemove);
        }
        // Remove the device from the session module's topology as well.
        if (this.shared.modules.sessions.hasSessionModule(modules)) {
            await this.shared.modules.sessions.removeIdentitySignerFromModules(modules, deviceToRemove);
        }
        // Request the configuration update.
        const requestId = await this.requestConfigurationUpdate(wallet, {
            devicesTopology: nextDevicesTopology,
            modules,
        }, action, 'wallet-webapp');
        return requestId;
    }
}

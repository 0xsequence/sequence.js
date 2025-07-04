import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core';
import { IdentityInstrument } from '@0xsequence/identity-instrument';
import { createAttestationVerifyingFetch } from '@0xsequence/tee-verifier';
import { Constants, Context, Extensions, Network, } from '@0xsequence/wallet-primitives';
import * as Db from '../dbs/index.js';
import { Cron } from './cron.js';
import { Devices } from './devices.js';
import { AuthCodeHandler } from './handlers/authcode.js';
import { AuthCodePkceHandler, DevicesHandler, MnemonicHandler, OtpHandler, PasskeysHandler, } from './handlers/index.js';
import { RecoveryHandler } from './handlers/recovery.js';
import { Logger } from './logger.js';
import { Messages } from './messages.js';
import { Recovery } from './recovery.js';
import { Sessions } from './sessions.js';
import { Signatures } from './signatures.js';
import { Signers } from './signers.js';
import { Transactions } from './transactions.js';
import { Kinds } from './types/signer.js';
import { Wallets } from './wallets.js';
export const ManagerOptionsDefaults = {
    verbose: false,
    extensions: Extensions.Dev1,
    context: Context.Dev1,
    context4337: Context.Dev2_4337,
    guest: Constants.DefaultGuest,
    encryptedPksDb: new CoreSigners.Pk.Encrypted.EncryptedPksDb(),
    managerDb: new Db.Wallets(),
    signaturesDb: new Db.Signatures(),
    transactionsDb: new Db.Transactions(),
    messagesDb: new Db.Messages(),
    authCommitmentsDb: new Db.AuthCommitments(),
    recoveryDb: new Db.Recovery(),
    authKeysDb: new Db.AuthKeys(),
    dbPruningInterval: 1000 * 60 * 60 * 24, // 24 hours
    stateProvider: new State.Sequence.Provider(),
    networks: Network.All,
    relayers: () => [Relayer.Standard.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined),
    bundlers: [],
    defaultGuardTopology: {
        // TODO: Move this somewhere else
        type: 'signer',
        address: '0xf71eC72C8C03a0857DD7601ACeF1e42b85983e99',
        weight: 1n,
    },
    defaultSessionsTopology: {
        // TODO: Move this somewhere else
        type: 'sapient-signer',
        weight: 10n,
    },
    defaultRecoverySettings: {
        requiredDeltaTime: 2592000n, // 30 days (in seconds)
        minTimestamp: 0n,
    },
    multiInjectedProviderDiscovery: true,
    identity: {
        // TODO: change to prod url once deployed
        url: 'https://dev-identity.sequence-dev.app',
        fetch: window.fetch,
        verifyAttestation: true,
        email: {
            enabled: false,
        },
        google: {
            enabled: false,
            clientId: '',
        },
        apple: {
            enabled: false,
            clientId: '',
        },
    },
};
export const CreateWalletOptionsDefaults = {
    useGuard: false,
};
export function applyManagerOptionsDefaults(options) {
    return {
        ...ManagerOptionsDefaults,
        ...options,
        identity: { ...ManagerOptionsDefaults.identity, ...options?.identity },
    };
}
export class Manager {
    shared;
    mnemonicHandler;
    devicesHandler;
    passkeysHandler;
    recoveryHandler;
    otpHandler;
    constructor(options) {
        const ops = applyManagerOptionsDefaults(options);
        // Build relayers list
        let relayers = [];
        // Add EIP-6963 relayers if enabled
        if (ops.multiInjectedProviderDiscovery) {
            try {
                relayers.push(...Relayer.Standard.EIP6963.getRelayers());
            }
            catch (error) {
                console.warn('Failed to initialize EIP-6963 relayers:', error);
            }
        }
        // Add configured relayers
        const configuredRelayers = typeof ops.relayers === 'function' ? ops.relayers() : ops.relayers;
        relayers.push(...configuredRelayers);
        const shared = {
            verbose: ops.verbose,
            sequence: {
                context: ops.context,
                context4337: ops.context4337,
                extensions: ops.extensions,
                guest: ops.guest,
                stateProvider: ops.stateProvider,
                networks: ops.networks,
                relayers,
                bundlers: ops.bundlers,
                defaultGuardTopology: ops.defaultGuardTopology,
                defaultRecoverySettings: ops.defaultRecoverySettings,
            },
            databases: {
                encryptedPks: ops.encryptedPksDb,
                manager: ops.managerDb,
                signatures: ops.signaturesDb,
                transactions: ops.transactionsDb,
                messages: ops.messagesDb,
                authCommitments: ops.authCommitmentsDb,
                authKeys: ops.authKeysDb,
                recovery: ops.recoveryDb,
                pruningInterval: ops.dbPruningInterval,
            },
            modules: {},
            handlers: new Map(),
        };
        const modules = {
            cron: new Cron(shared),
            logger: new Logger(shared),
            devices: new Devices(shared),
            wallets: new Wallets(shared),
            sessions: new Sessions(shared),
            signers: new Signers(shared),
            signatures: new Signatures(shared),
            transactions: new Transactions(shared),
            messages: new Messages(shared),
            recovery: new Recovery(shared),
        };
        this.devicesHandler = new DevicesHandler(modules.signatures, modules.devices);
        shared.handlers.set(Kinds.LocalDevice, this.devicesHandler);
        this.passkeysHandler = new PasskeysHandler(modules.signatures, shared.sequence.extensions, shared.sequence.stateProvider);
        shared.handlers.set(Kinds.LoginPasskey, this.passkeysHandler);
        this.mnemonicHandler = new MnemonicHandler(modules.signatures);
        shared.handlers.set(Kinds.LoginMnemonic, this.mnemonicHandler);
        this.recoveryHandler = new RecoveryHandler(modules.signatures, modules.recovery);
        shared.handlers.set(Kinds.Recovery, this.recoveryHandler);
        const verifyingFetch = ops.identity.verifyAttestation
            ? createAttestationVerifyingFetch({
                fetch: ops.identity.fetch,
                expectedPCRs: ops.identity.expectedPcr0 ? new Map([[0, ops.identity.expectedPcr0]]) : undefined,
                logTiming: true,
            })
            : ops.identity.fetch;
        const identityInstrument = new IdentityInstrument(ops.identity.url, verifyingFetch);
        if (ops.identity.email?.enabled) {
            this.otpHandler = new OtpHandler(identityInstrument, modules.signatures, shared.databases.authKeys);
            shared.handlers.set(Kinds.LoginEmailOtp, this.otpHandler);
        }
        if (ops.identity.google?.enabled) {
            shared.handlers.set(Kinds.LoginGooglePkce, new AuthCodePkceHandler('google-pkce', 'https://accounts.google.com', ops.identity.google.clientId, identityInstrument, modules.signatures, shared.databases.authCommitments, shared.databases.authKeys));
        }
        if (ops.identity.apple?.enabled) {
            shared.handlers.set(Kinds.LoginApple, new AuthCodeHandler('apple', 'https://appleid.apple.com', ops.identity.apple.clientId, identityInstrument, modules.signatures, shared.databases.authCommitments, shared.databases.authKeys));
        }
        shared.modules = modules;
        this.shared = shared;
        // Initialize modules
        for (const module of Object.values(modules)) {
            if ('initialize' in module && typeof module.initialize === 'function') {
                module.initialize();
            }
        }
    }
    // Wallets
    async startSignUpWithRedirect(args) {
        return this.shared.modules.wallets.startSignUpWithRedirect(args);
    }
    async completeRedirect(args) {
        return this.shared.modules.wallets.completeRedirect(args);
    }
    async signUp(options) {
        return this.shared.modules.wallets.signUp(options);
    }
    async logout(wallet, options) {
        return this.shared.modules.wallets.logout(wallet, options);
    }
    async completeLogout(requestId, options) {
        return this.shared.modules.wallets.completeLogout(requestId, options);
    }
    async login(args) {
        return this.shared.modules.wallets.login(args);
    }
    async completeLogin(requestId) {
        return this.shared.modules.wallets.completeLogin(requestId);
    }
    async listWallets() {
        return this.shared.modules.wallets.list();
    }
    async hasWallet(address) {
        return this.shared.modules.wallets.exists(address);
    }
    onWalletsUpdate(cb, trigger) {
        return this.shared.modules.wallets.onWalletsUpdate(cb, trigger);
    }
    registerWalletSelector(handler) {
        return this.shared.modules.wallets.registerWalletSelector(handler);
    }
    unregisterWalletSelector(handler) {
        return this.shared.modules.wallets.unregisterWalletSelector(handler);
    }
    async getConfiguration(wallet) {
        return this.shared.modules.wallets.getConfiguration(wallet);
    }
    async getOnchainConfiguration(wallet, chainId) {
        return this.shared.modules.wallets.getOnchainConfiguration(wallet, chainId);
    }
    async isUpdatedOnchain(wallet, chainId) {
        return this.shared.modules.wallets.isUpdatedOnchain(wallet, chainId);
    }
    // Signatures
    async listSignatureRequests() {
        return this.shared.modules.signatures.list();
    }
    async getSignatureRequest(requestId) {
        return this.shared.modules.signatures.get(requestId);
    }
    onSignatureRequestsUpdate(cb, trigger) {
        return this.shared.modules.signatures.onSignatureRequestsUpdate(cb, trigger);
    }
    onSignatureRequestUpdate(requestId, cb, onError, trigger) {
        return this.shared.modules.signatures.onSignatureRequestUpdate(requestId, cb, onError, trigger);
    }
    async cancelSignatureRequest(requestId) {
        return this.shared.modules.signatures.cancel(requestId);
    }
    // Transactions
    async requestTransaction(from, chainId, txs, options) {
        return this.shared.modules.transactions.request(from, chainId, txs, options);
    }
    async defineTransaction(transactionId, changes) {
        return this.shared.modules.transactions.define(transactionId, changes);
    }
    async selectTransactionRelayer(transactionId, relayerOptionId) {
        return this.shared.modules.transactions.selectRelayer(transactionId, relayerOptionId);
    }
    async relayTransaction(transactionOrSignatureId) {
        return this.shared.modules.transactions.relay(transactionOrSignatureId);
    }
    async deleteTransaction(transactionId) {
        return this.shared.modules.transactions.delete(transactionId);
    }
    onTransactionsUpdate(cb, trigger) {
        return this.shared.modules.transactions.onTransactionsUpdate(cb, trigger);
    }
    onTransactionUpdate(transactionId, cb, trigger) {
        return this.shared.modules.transactions.onTransactionUpdate(transactionId, cb, trigger);
    }
    getTransaction(transactionId) {
        return this.shared.modules.transactions.get(transactionId);
    }
    registerMnemonicUI(onPromptMnemonic) {
        return this.mnemonicHandler.registerUI(onPromptMnemonic);
    }
    registerOtpUI(onPromptOtp) {
        return this.otpHandler?.registerUI(onPromptOtp) || (() => { });
    }
    async setRedirectPrefix(prefix) {
        this.shared.handlers.forEach((handler) => {
            if (handler instanceof AuthCodeHandler) {
                handler.setRedirectUri(prefix + '/' + handler.signupKind);
            }
        });
    }
    // Messages
    async listMessageRequests() {
        return this.shared.modules.messages.list();
    }
    async getMessageRequest(messageOrSignatureId) {
        return this.shared.modules.messages.get(messageOrSignatureId);
    }
    onMessageRequestsUpdate(cb, trigger) {
        return this.shared.modules.messages.onMessagesUpdate(cb, trigger);
    }
    onMessageRequestUpdate(messageOrSignatureId, cb, trigger) {
        return this.shared.modules.messages.onMessageUpdate(messageOrSignatureId, cb, trigger);
    }
    async requestMessageSignature(wallet, message, chainId, options) {
        return this.shared.modules.messages.request(wallet, message, chainId, options);
    }
    async completedMessageSignature(messageOrSignatureId) {
        return this.shared.modules.messages.complete(messageOrSignatureId);
    }
    async deleteMessageRequest(messageOrSignatureId) {
        return this.shared.modules.messages.delete(messageOrSignatureId);
    }
    // Sessions
    async getSessionTopology(walletAddress) {
        return this.shared.modules.sessions.getSessionTopology(walletAddress);
    }
    async prepareAuthorizeImplicitSession(walletAddress, sessionAddress, args) {
        return this.shared.modules.sessions.prepareAuthorizeImplicitSession(walletAddress, sessionAddress, args);
        // Run completeAuthorizeImplicitSession next
    }
    async completeAuthorizeImplicitSession(requestId) {
        return this.shared.modules.sessions.completeAuthorizeImplicitSession(requestId);
    }
    async addExplicitSession(walletAddress, sessionAddress, permissions) {
        return this.shared.modules.sessions.addExplicitSession(walletAddress, sessionAddress, permissions);
        // Run completeSessionUpdate next
    }
    async removeExplicitSession(walletAddress, sessionAddress) {
        return this.shared.modules.sessions.removeExplicitSession(walletAddress, sessionAddress);
        // Run completeSessionUpdate next
    }
    async addBlacklistAddress(walletAddress, address) {
        return this.shared.modules.sessions.addBlacklistAddress(walletAddress, address);
        // Run completeSessionUpdate next
    }
    async removeBlacklistAddress(walletAddress, address) {
        return this.shared.modules.sessions.removeBlacklistAddress(walletAddress, address);
        // Run completeSessionUpdate next
    }
    async completeSessionUpdate(requestId) {
        return this.shared.modules.sessions.completeSessionUpdate(requestId);
    }
    // Recovery
    async getRecoverySigners(wallet) {
        return this.shared.modules.recovery.getRecoverySigners(wallet);
    }
    onQueuedRecoveryPayloadsUpdate(wallet, cb, trigger) {
        return this.shared.modules.recovery.onQueuedRecoveryPayloadsUpdate(wallet, cb, trigger);
    }
    async queueRecoveryPayload(wallet, chainId, payload) {
        return this.shared.modules.recovery.queueRecoveryPayload(wallet, chainId, payload);
    }
    async completeRecoveryPayload(requestId) {
        return this.shared.modules.recovery.completeRecoveryPayload(requestId);
    }
    async addRecoveryMnemonic(wallet, mnemonic) {
        return this.shared.modules.recovery.addRecoveryMnemonic(wallet, mnemonic);
    }
    async addRecoverySigner(wallet, address) {
        return this.shared.modules.recovery.addRecoverySigner(wallet, address);
    }
    async removeRecoverySigner(wallet, address) {
        return this.shared.modules.recovery.removeRecoverySigner(wallet, address);
    }
    async completeRecoveryUpdate(requestId) {
        return this.shared.modules.recovery.completeRecoveryUpdate(requestId);
    }
    async updateQueuedRecoveryPayloads() {
        return this.shared.modules.recovery.updateQueuedRecoveryPayloads();
    }
    getNetworks() {
        return this.shared.sequence.networks;
    }
    getNetwork(chainId) {
        return this.shared.sequence.networks.find((n) => n.chainId === chainId);
    }
    // DBs
    async stop() {
        await this.shared.modules.cron.stop();
        await Promise.all([
            this.shared.databases.authKeys.close(),
            this.shared.databases.authCommitments.close(),
            this.shared.databases.manager.close(),
            this.shared.databases.recovery.close(),
            this.shared.databases.signatures.close(),
            this.shared.databases.transactions.close(),
        ]);
    }
}

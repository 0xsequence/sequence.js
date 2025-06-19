import { Config } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { AuthCommitment } from '../dbs/auth-commitments.js';
import { Shared } from './manager.js';
import { Action } from './types/index.js';
import { Wallet, WalletSelectionUiHandler } from './types/wallet.js';
export type StartSignUpWithRedirectArgs = {
    kind: 'google-pkce' | 'apple';
    target: string;
    metadata: {
        [key: string]: string;
    };
};
export type CommonSignupArgs = {
    noGuard?: boolean;
    noSessionManager?: boolean;
    noRecovery?: boolean;
};
export type PasskeySignupArgs = CommonSignupArgs & {
    kind: 'passkey';
};
export type MnemonicSignupArgs = CommonSignupArgs & {
    kind: 'mnemonic';
    mnemonic: string;
};
export type EmailOtpSignupArgs = CommonSignupArgs & {
    kind: 'email-otp';
    email: string;
};
export type CompleteRedirectArgs = CommonSignupArgs & {
    state: string;
    code: string;
};
export type AuthCodeSignupArgs = CommonSignupArgs & {
    kind: 'google-pkce' | 'apple';
    commitment: AuthCommitment;
    code: string;
    target: string;
    isRedirect: boolean;
};
export type SignupArgs = PasskeySignupArgs | MnemonicSignupArgs | EmailOtpSignupArgs | AuthCodeSignupArgs;
export type LoginToWalletArgs = {
    wallet: Address.Address;
};
export type LoginToMnemonicArgs = {
    kind: 'mnemonic';
    mnemonic: string;
    selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>;
};
export type LoginToPasskeyArgs = {
    kind: 'passkey';
    selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>;
};
export type LoginArgs = LoginToWalletArgs | LoginToMnemonicArgs | LoginToPasskeyArgs;
export declare function isLoginToWalletArgs(args: LoginArgs): args is LoginToWalletArgs;
export declare function isLoginToMnemonicArgs(args: LoginArgs): args is LoginToMnemonicArgs;
export declare function isLoginToPasskeyArgs(args: LoginArgs): args is LoginToPasskeyArgs;
export declare function isAuthCodeArgs(args: SignupArgs): args is AuthCodeSignupArgs;
declare function fromConfig(config: Config.Config): {
    loginTopology: Config.Topology;
    devicesTopology: Config.Topology;
    modules: Config.SapientSignerLeaf[];
    guardTopology?: Config.Topology;
};
export declare class Wallets {
    private readonly shared;
    private walletSelectionUiHandler;
    constructor(shared: Shared);
    exists(wallet: Address.Address): Promise<boolean>;
    get(walletAddress: Address.Address): Promise<Wallet | undefined>;
    list(): Promise<Wallet[]>;
    registerWalletSelector(handler: WalletSelectionUiHandler): () => void;
    unregisterWalletSelector(handler?: WalletSelectionUiHandler): void;
    onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean): () => void;
    private prepareSignUp;
    startSignUpWithRedirect(args: StartSignUpWithRedirectArgs): Promise<string>;
    completeRedirect(args: CompleteRedirectArgs): Promise<string>;
    signUp(args: SignupArgs): Promise<`0x${string}` | undefined>;
    getConfigurationParts(address: Address.Address): Promise<{
        loginTopology: Config.Topology;
        devicesTopology: Config.Topology;
        modules: Config.SapientSignerLeaf[];
        guardTopology?: Config.Topology;
    }>;
    requestConfigurationUpdate(address: Address.Address, changes: Partial<ReturnType<typeof fromConfig>>, action: Action, origin?: string): Promise<string>;
    completeConfigurationUpdate(requestId: string): Promise<void>;
    login(args: LoginArgs): Promise<string | undefined>;
    completeLogin(requestId: string): Promise<void>;
    logout<T extends {
        skipRemoveDevice?: boolean;
    } | undefined = undefined>(wallet: Address.Address, options?: T): Promise<T extends {
        skipRemoveDevice: true;
    } ? undefined : string>;
    completeLogout(requestId: string, options?: {
        skipValidateSave?: boolean;
    }): Promise<void>;
    getConfiguration(wallet: Address.Address): Promise<{
        devices: import("./types/signer.js").SignerWithKind[];
        login: import("./types/signer.js").SignerWithKind[];
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Config.SapientSignerLeaf[];
            guardTopology?: Config.Topology;
        };
    }>;
    getNonce(chainId: bigint, address: Address.Address, space: bigint): Promise<bigint>;
    getOnchainConfiguration(wallet: Address.Address, chainId: bigint): Promise<{
        devices: import("./types/signer.js").SignerWithKind[];
        login: import("./types/signer.js").SignerWithKind[];
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Config.SapientSignerLeaf[];
            guardTopology?: Config.Topology;
        };
    }>;
    isUpdatedOnchain(wallet: Address.Address, chainId: bigint): Promise<boolean>;
}
export {};
//# sourceMappingURL=wallets.d.ts.map
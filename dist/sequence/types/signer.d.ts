import { Address, Hex } from 'ox';
export declare const Kinds: {
    readonly LocalDevice: "local-device";
    readonly LoginPasskey: "login-passkey";
    readonly LoginMnemonic: "login-mnemonic";
    readonly LoginEmailOtp: "login-email-otp";
    readonly LoginGooglePkce: "login-google-pkce";
    readonly LoginApple: "login-apple";
    readonly Recovery: "recovery-extension";
    readonly Guard: "guard-extension";
    readonly Unknown: "unknown";
};
export type Kind = (typeof Kinds)[keyof typeof Kinds];
export type WitnessExtraSignerKind = {
    signerKind: string;
};
export type SignerWithKind = {
    address: Address.Address;
    kind?: Kind;
    imageHash?: Hex.Hex;
};
export type RecoverySigner = {
    kind: Kind;
    isRecovery: true;
    address: Address.Address;
    minTimestamp: bigint;
    requiredDeltaTime: bigint;
};
//# sourceMappingURL=signer.d.ts.map
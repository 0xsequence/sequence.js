import { AbiFunction, Address, Bytes, Hex } from 'ox';
import { RECOVER_SAPIENT_SIGNATURE } from './constants.js';
import { Attestation } from './index.js';
import { UserOperation } from 'ox/erc4337';
export declare const KIND_TRANSACTIONS = 0;
export declare const KIND_MESSAGE = 1;
export declare const KIND_CONFIG_UPDATE = 2;
export declare const KIND_DIGEST = 3;
export declare const BEHAVIOR_IGNORE_ERROR = 0;
export declare const BEHAVIOR_REVERT_ON_ERROR = 1;
export declare const BEHAVIOR_ABORT_ON_ERROR = 2;
interface SolidityCall {
    to: Address.Address;
    value: bigint;
    data: Hex.Hex;
    gasLimit: bigint;
    delegateCall: boolean;
    onlyFallback: boolean;
    behaviorOnError: bigint;
}
export interface SolidityDecoded {
    kind: number;
    noChainId: boolean;
    calls: SolidityCall[];
    space: bigint;
    nonce: bigint;
    message: Hex.Hex;
    imageHash: Hex.Hex;
    digest: Hex.Hex;
    parentWallets: Address.Address[];
}
export type Call = {
    to: Address.Address;
    value: bigint;
    data: Hex.Hex;
    gasLimit: bigint;
    delegateCall: boolean;
    onlyFallback: boolean;
    behaviorOnError: 'ignore' | 'revert' | 'abort';
};
export type Calls = {
    type: 'call';
    space: bigint;
    nonce: bigint;
    calls: Call[];
};
export type Message = {
    type: 'message';
    message: Hex.Hex;
};
export type ConfigUpdate = {
    type: 'config-update';
    imageHash: Hex.Hex;
};
export type Digest = {
    type: 'digest';
    digest: Hex.Hex;
};
export type SessionImplicitAuthorize = {
    type: 'session-implicit-authorize';
    sessionAddress: Address.Address;
    attestation: Attestation.Attestation;
};
export type Parent = {
    parentWallets?: Address.Address[];
};
export type Calls4337_07 = {
    type: 'call_4337_07';
    calls: Call[];
    entrypoint: Address.Address;
    callGasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    space: bigint;
    nonce: bigint;
    paymaster?: Address.Address | undefined;
    paymasterData?: Hex.Hex | undefined;
    paymasterPostOpGasLimit?: bigint | undefined;
    paymasterVerificationGasLimit?: bigint | undefined;
    preVerificationGas: bigint;
    verificationGasLimit: bigint;
    factory?: Address.Address | undefined;
    factoryData?: Hex.Hex | undefined;
};
export type Recovery<T extends Calls | Message | ConfigUpdate | Digest> = T & {
    recovery: true;
};
export type MayRecoveryPayload = Calls | Message | ConfigUpdate | Digest;
export type Payload = Calls | Message | ConfigUpdate | Digest | Recovery<Calls | Message | ConfigUpdate | Digest> | SessionImplicitAuthorize | Calls4337_07;
export type Parented = Payload & Parent;
export type TypedDataToSign = {
    domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: Address.Address;
    };
    types: Record<string, Array<{
        name: string;
        type: string;
    }>>;
    primaryType: string;
    message: Record<string, unknown>;
};
export declare function fromMessage(message: Hex.Hex): Message;
export declare function fromConfigUpdate(imageHash: Hex.Hex): ConfigUpdate;
export declare function fromDigest(digest: Hex.Hex): Digest;
export declare function fromCall(nonce: bigint, space: bigint, calls: Call[]): Calls;
export declare function isCalls(payload: Payload): payload is Calls;
export declare function isMessage(payload: Payload): payload is Message;
export declare function isConfigUpdate(payload: Payload): payload is ConfigUpdate;
export declare function isDigest(payload: Payload): payload is Digest;
export declare function isRecovery<T extends MayRecoveryPayload>(payload: Payload): payload is Recovery<T>;
export declare function isCalls4337_07(payload: Payload): payload is Calls4337_07;
export declare function isParented(payload: Payload): payload is Parented;
export declare function toRecovery<T extends MayRecoveryPayload>(payload: T): Recovery<T>;
export declare function isSessionImplicitAuthorize(payload: Payload): payload is SessionImplicitAuthorize;
export declare function encode(payload: Calls, self?: Address.Address): Bytes.Bytes;
export declare function encodeSapient(chainId: number, payload: Parented): Exclude<AbiFunction.encodeData.Args<typeof RECOVER_SAPIENT_SIGNATURE>[0], undefined>[0];
export declare function hash(wallet: Address.Address, chainId: number, payload: Parented): Bytes.Bytes;
export declare function encode4337Nonce(key: bigint, seq: bigint): bigint;
export declare function toTyped(wallet: Address.Address, chainId: number, payload: Parented): TypedDataToSign;
export declare function to4337UserOperation(payload: Calls4337_07, wallet: Address.Address, signature?: Hex.Hex): UserOperation.UserOperation<'0.7'>;
export declare function to4337Message(payload: Calls4337_07, wallet: Address.Address, chainId: number): Hex.Hex;
export declare function encodeBehaviorOnError(behaviorOnError: Call['behaviorOnError']): number;
export declare function hashCall(call: Call): Hex.Hex;
export declare function decode(packed: Bytes.Bytes, self?: Address.Address): Calls;
export declare function decodeBehaviorOnError(value: number): Call['behaviorOnError'];
export declare function fromAbiFormat(decoded: SolidityDecoded): Parented;
export declare function toAbiFormat(payload: Parented): SolidityDecoded;
export {};
//# sourceMappingURL=payload.d.ts.map
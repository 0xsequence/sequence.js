import { Relayer } from '@0xsequence/relayer';
import { ExplicitSession } from '@0xsequence/wallet-core';
import { Attestation, Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import type { TypedData } from 'ox/TypedData';
export type FeeToken = Relayer.FeeToken;
export type FeeOption = Relayer.FeeOption;
export type OperationFailedStatus = Relayer.OperationFailedStatus;
export type OperationStatus = Relayer.OperationStatus;
export declare const RequestActionType: {
    readonly CREATE_NEW_SESSION: "createNewSession";
    readonly ADD_EXPLICIT_SESSION: "addExplicitSession";
    readonly MODIFY_EXPLICIT_SESSION: "modifyExplicitSession";
    readonly SIGN_MESSAGE: "signMessage";
    readonly SIGN_TYPED_DATA: "signTypedData";
    readonly SEND_WALLET_TRANSACTION: "sendWalletTransaction";
};
export type LoginMethod = 'google' | 'apple' | 'email' | 'passkey' | 'mnemonic';
export interface GuardConfig {
    url: string;
    moduleAddresses: Map<Address.Address, Address.Address>;
}
export interface CreateNewSessionPayload {
    origin?: string;
    session?: ExplicitSession;
    includeImplicitSession?: boolean;
    preferredLoginMethod?: LoginMethod;
    email?: string;
}
export interface AddExplicitSessionPayload {
    session: ExplicitSession;
    preferredLoginMethod?: LoginMethod;
    email?: string;
}
export interface ModifyExplicitSessionPayload {
    walletAddress: Address.Address;
    session: ExplicitSession;
}
export interface SignMessagePayload {
    address: Address.Address;
    message: string;
    chainId: number;
}
export interface SignTypedDataPayload {
    address: Address.Address;
    typedData: TypedData;
    chainId: number;
}
export interface SendWalletTransactionPayload {
    address: Address.Address;
    transactionRequest: TransactionRequest;
    chainId: number;
}
export type TransactionRequest = {
    to: Address.Address;
    value?: bigint;
    data?: Hex.Hex;
    gasLimit?: bigint;
};
export interface CreateNewSessionResponse {
    walletAddress: string;
    attestation?: Attestation.Attestation;
    signature?: Hex.Hex;
    userEmail?: string;
    loginMethod?: LoginMethod;
    guard?: GuardConfig;
}
export interface SignatureResponse {
    signature: Hex.Hex;
    walletAddress: string;
}
export interface SendWalletTransactionResponse {
    transactionHash: Hex.Hex;
    walletAddress: string;
}
export type WalletActionResponse = SignatureResponse | SendWalletTransactionResponse;
export interface SessionResponse {
    walletAddress: string;
    sessionAddress: string;
}
export type RandomPrivateKeyFn = () => Hex.Hex | Promise<Hex.Hex>;
type RequiredKeys = 'to' | 'data' | 'value';
export type Transaction = Pick<Payload.Call, RequiredKeys> & Partial<Omit<Payload.Call, RequiredKeys>>;
export type ExplicitSessionEventListener = (data: {
    action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION'];
    response?: SessionResponse;
    error?: any;
}) => void;
export type DappClientEventListener = (data?: any) => void;
export type DappClientWalletActionEventListener = (data: {
    action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA' | 'SEND_WALLET_TRANSACTION'];
    response?: WalletActionResponse;
    error?: any;
    chainId: number;
}) => void;
export type DappClientExplicitSessionEventListener = (data: {
    action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION'];
    response?: SessionResponse;
    error?: any;
    chainId: number;
}) => void;
export interface SequenceSessionStorage {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
}
export declare enum MessageType {
    WALLET_OPENED = "WALLET_OPENED",
    INIT = "INIT",
    REQUEST = "REQUEST",
    RESPONSE = "RESPONSE"
}
export declare enum TransportMode {
    POPUP = "popup",
    REDIRECT = "redirect"
}
export interface PopupModeOptions {
    requestTimeoutMs?: number;
    handshakeTimeoutMs?: number;
}
export interface TransportMessage<T = any> {
    id: string;
    type: MessageType;
    sessionId?: string;
    action?: string;
    payload?: T;
    error?: any;
}
export declare const WalletSize: {
    width: number;
    height: number;
};
export interface PendingRequest {
    resolve: (payload: any) => void;
    reject: (error: any) => void;
    timer: number;
    action: string;
}
export interface SendRequestOptions {
    timeout?: number;
    path?: string;
}
export type GetFeeTokensResponse = {
    isFeeRequired: boolean;
    tokens?: FeeToken[];
    paymentAddress?: Address.Address;
};
export {};
//# sourceMappingURL=index.d.ts.map
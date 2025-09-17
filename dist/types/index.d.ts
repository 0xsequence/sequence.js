import { Attestation, Payload } from '@0xsequence/wallet-primitives';
import { Signers } from '@0xsequence/wallet-core';
import { Address, Hex } from 'ox';
import type { TypedData } from 'ox/TypedData';
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
    sessionAddress: Address.Address;
    origin: string;
    permissions?: Signers.Session.ExplicitParams;
    includeImplicitSession?: boolean;
    preferredLoginMethod?: LoginMethod;
    email?: string;
}
export interface AddExplicitSessionPayload {
    sessionAddress: Address.Address;
    permissions: Signers.Session.ExplicitParams;
    preferredLoginMethod?: LoginMethod;
    email?: string;
}
export interface ModifySessionPayload {
    walletAddress: Address.Address;
    sessionAddress: Address.Address;
    permissions: Signers.Session.ExplicitParams;
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
export type TransactionRequest = {
    to: Address.Address;
    value?: bigint;
    data?: Hex.Hex;
    gasLimit?: bigint;
};
export interface SendWalletTransactionPayload {
    address: Address.Address;
    transactionRequest: TransactionRequest;
    chainId: number;
}
export interface ConnectSuccessResponsePayload {
    walletAddress: string;
    attestation?: Attestation.Attestation;
    signature?: Hex.Hex;
    userEmail?: string;
    loginMethod?: LoginMethod;
    guard?: GuardConfig;
}
export interface AddExplicitSessionSuccessResponsePayload {
    walletAddress: string;
    sessionAddress: string;
}
export interface ModifySessionSuccessResponsePayload {
    walletAddress: string;
    sessionAddress: string;
}
export interface SignatureSuccessResponse {
    signature: Hex.Hex;
    walletAddress: string;
}
export interface SendWalletTransactionSuccessResponse {
    transactionHash: Hex.Hex;
    walletAddress: string;
}
export type WalletActionResponse = SignatureSuccessResponse | SendWalletTransactionSuccessResponse;
export type RandomPrivateKeyFn = () => Hex.Hex | Promise<Hex.Hex>;
type RequiredKeys = 'to' | 'data' | 'value';
export type Transaction = Pick<Payload.Call, RequiredKeys> & Partial<Omit<Payload.Call, RequiredKeys>>;
export type Session = {
    address: Address.Address;
    isImplicit: boolean;
    permissions?: Signers.Session.ExplicitParams;
    chainId?: number;
};
export type ChainSessionManagerEvent = 'sessionsUpdated' | 'explicitSessionResponse';
export type ExplicitSessionEventListener = (data: {
    action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION'];
    response?: AddExplicitSessionSuccessResponsePayload | ModifySessionSuccessResponsePayload;
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
    response?: AddExplicitSessionSuccessResponsePayload | ModifySessionSuccessResponsePayload;
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
export interface BaseRequest {
    type: string;
}
export interface MessageSignatureRequest extends BaseRequest {
    type: 'message_signature';
    message: string;
    address: Address.Address;
    chainId: number;
}
export interface TypedDataSignatureRequest extends BaseRequest {
    type: 'typed_data_signature';
    typedData: unknown;
    address: Address.Address;
    chainId: number;
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
export {};
//# sourceMappingURL=index.d.ts.map
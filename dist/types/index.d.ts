import { Attestation, Payload } from '@0xsequence/wallet-primitives';
import { Signers } from '@0xsequence/wallet-core';
import { ChainId } from '@0xsequence/network';
import { Address, Hex } from 'ox';
import type { TypedData } from 'ox/TypedData';
export declare const RequestActionType: {
    readonly ADD_EXPLICIT_SESSION: "addExplicitSession";
    readonly MODIFY_EXPLICIT_SESSION: "modifyExplicitSession";
    readonly ADD_IMPLICIT_SESSION: "addImplicitSession";
    readonly SIGN_MESSAGE: "signMessage";
    readonly SIGN_TYPED_DATA: "signTypedData";
};
export type PreferredLoginMethod = 'google' | 'apple' | 'email' | 'passkey' | 'mnemonic';
export interface AddExplicitSessionPayload {
    sessionAddress: Address.Address;
    permissions: Signers.Session.ExplicitParams;
    preferredLoginMethod?: PreferredLoginMethod;
    email?: string;
}
export interface ModifySessionPayload {
    walletAddress: Address.Address;
    sessionAddress: Address.Address;
    permissions: Signers.Session.ExplicitParams;
}
export interface AddImplicitSessionPayload {
    sessionAddress: Address.Address;
    implicitSessionRedirectUrl?: string;
    permissions?: Signers.Session.ExplicitParams;
    preferredLoginMethod?: PreferredLoginMethod;
    email?: string;
}
export interface SignMessagePayload {
    address: Address.Address;
    message: string;
    chainId: ChainId;
}
export interface SignTypedDataPayload {
    address: Address.Address;
    typedData: TypedData;
    chainId: ChainId;
}
export interface ConnectSuccessResponsePayload {
    walletAddress: string;
    attestation?: Attestation.Attestation;
    signature?: Hex.Hex;
    email?: string;
    loginMethod?: PreferredLoginMethod;
}
export interface ModifySessionSuccessResponsePayload {
    walletAddress: string;
    sessionAddress: string;
}
export interface SignatureResponse {
    signature: Hex.Hex;
    walletAddress: string;
}
export interface ExplicitSessionResponsePayload {
    walletAddress: string;
    sessionAddress: string;
}
export type RandomPrivateKeyFn = () => Hex.Hex | Promise<Hex.Hex>;
type RequiredKeys = 'to' | 'data' | 'value';
export type Transaction = Pick<Payload.Call, RequiredKeys> & Partial<Omit<Payload.Call, RequiredKeys>>;
export type Session = {
    address: Address.Address;
    isImplicit: boolean;
};
export type ChainSessionManagerEvent = 'signatureResponse' | 'sessionsUpdated' | 'explicitSessionResponse';
export type SignatureEventListener = (data: {
    action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA'];
    response?: SignatureResponse;
    error?: any;
}) => void;
export type ExplicitSessionEventListener = (data: {
    action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION'];
    response?: ExplicitSessionResponsePayload;
    error?: any;
}) => void;
export type DappClientEventListener = (data?: any) => void;
export type DappClientSignatureEventListener = (data: {
    action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA'];
    response?: SignatureResponse;
    error?: any;
    chainId: number;
}) => void;
export type DappClientExplicitSessionEventListener = (data: {
    action: (typeof RequestActionType)['ADD_EXPLICIT_SESSION' | 'MODIFY_EXPLICIT_SESSION'];
    response?: ExplicitSessionResponsePayload;
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
    redirectUrl?: string;
}
export {};
//# sourceMappingURL=index.d.ts.map
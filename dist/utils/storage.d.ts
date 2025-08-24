import { Attestation } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { AddExplicitSessionPayload, CreateNewSessionPayload, ModifySessionPayload, LoginMethod, SignMessagePayload, SignTypedDataPayload } from '../types/index.js';
export interface ExplicitSessionData {
    pk: Hex.Hex;
    walletAddress: Address.Address;
    chainId: number;
    loginMethod?: LoginMethod;
    userEmail?: string;
}
export interface ImplicitSessionData {
    pk: Hex.Hex;
    walletAddress: Address.Address;
    attestation: Attestation.Attestation;
    identitySignature: Hex.Hex;
    chainId: number;
    loginMethod?: LoginMethod;
    userEmail?: string;
}
export type PendingPayload = CreateNewSessionPayload | AddExplicitSessionPayload | ModifySessionPayload | SignMessagePayload | SignTypedDataPayload;
export interface PendingRequestContext {
    chainId: number;
    action: string;
    payload: PendingPayload;
}
export interface SequenceStorage {
    setPendingRedirectRequest(isPending: boolean): Promise<void>;
    isRedirectRequestPending(): Promise<boolean>;
    saveTempSessionPk(pk: Hex.Hex): Promise<void>;
    getAndClearTempSessionPk(): Promise<Hex.Hex | null>;
    savePendingRequest(context: PendingRequestContext): Promise<void>;
    getAndClearPendingRequest(): Promise<PendingRequestContext | null>;
    peekPendingRequest(): Promise<PendingRequestContext | null>;
    saveExplicitSession(sessionData: ExplicitSessionData): Promise<void>;
    getExplicitSessions(): Promise<ExplicitSessionData[]>;
    clearExplicitSessions(): Promise<void>;
    saveImplicitSession(sessionData: ImplicitSessionData): Promise<void>;
    getImplicitSession(): Promise<ImplicitSessionData | null>;
    clearImplicitSession(): Promise<void>;
    clearAllData(): Promise<void>;
}
export declare class WebStorage implements SequenceStorage {
    private openDB;
    private getIDBItem;
    private setIDBItem;
    private deleteIDBItem;
    setPendingRedirectRequest(isPending: boolean): Promise<void>;
    isRedirectRequestPending(): Promise<boolean>;
    saveTempSessionPk(pk: Hex.Hex): Promise<void>;
    getAndClearTempSessionPk(): Promise<Hex.Hex | null>;
    savePendingRequest(context: PendingRequestContext): Promise<void>;
    getAndClearPendingRequest(): Promise<PendingRequestContext | null>;
    peekPendingRequest(): Promise<PendingRequestContext | null>;
    saveExplicitSession(sessionData: ExplicitSessionData): Promise<void>;
    getExplicitSessions(): Promise<ExplicitSessionData[]>;
    clearExplicitSessions(): Promise<void>;
    saveImplicitSession(sessionData: ImplicitSessionData): Promise<void>;
    getImplicitSession(): Promise<ImplicitSessionData | null>;
    clearImplicitSession(): Promise<void>;
    clearAllData(): Promise<void>;
}
//# sourceMappingURL=storage.d.ts.map
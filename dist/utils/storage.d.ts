import { Address, Hex } from 'ox';
import { LoginMethod, SignMessagePayload, SignTypedDataPayload, GuardConfig, SendWalletTransactionPayload, ModifyExplicitSessionPayload, CreateNewSessionPayload, AddExplicitSessionPayload } from '../types/index.js';
import { Attestation } from '../index.js';
export interface ExplicitSessionData {
    pk: Hex.Hex;
    walletAddress: Address.Address;
    chainId: number;
    loginMethod?: LoginMethod;
    userEmail?: string;
    guard?: GuardConfig;
}
export interface ImplicitSessionData {
    pk: Hex.Hex;
    walletAddress: Address.Address;
    attestation: Attestation.Attestation;
    identitySignature: Hex.Hex;
    chainId: number;
    loginMethod?: LoginMethod;
    userEmail?: string;
    guard?: GuardConfig;
}
export interface SessionlessConnectionData {
    walletAddress: Address.Address;
    loginMethod?: LoginMethod;
    userEmail?: string;
    guard?: GuardConfig;
}
export type PendingPayload = CreateNewSessionPayload | AddExplicitSessionPayload | ModifyExplicitSessionPayload | SignMessagePayload | SignTypedDataPayload | SendWalletTransactionPayload;
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
    saveSessionlessConnection(sessionData: SessionlessConnectionData): Promise<void>;
    getSessionlessConnection(): Promise<SessionlessConnectionData | null>;
    clearSessionlessConnection(): Promise<void>;
    saveSessionlessConnectionSnapshot?(sessionData: SessionlessConnectionData): Promise<void>;
    getSessionlessConnectionSnapshot?(): Promise<SessionlessConnectionData | null>;
    clearSessionlessConnectionSnapshot?(): Promise<void>;
    clearAllData(): Promise<void>;
}
export declare class WebStorage implements SequenceStorage {
    private inMemoryDb;
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
    saveSessionlessConnection(sessionData: SessionlessConnectionData): Promise<void>;
    getSessionlessConnection(): Promise<SessionlessConnectionData | null>;
    clearSessionlessConnection(): Promise<void>;
    saveSessionlessConnectionSnapshot(sessionData: SessionlessConnectionData): Promise<void>;
    getSessionlessConnectionSnapshot(): Promise<SessionlessConnectionData | null>;
    clearSessionlessConnectionSnapshot(): Promise<void>;
    clearAllData(): Promise<void>;
}
//# sourceMappingURL=storage.d.ts.map
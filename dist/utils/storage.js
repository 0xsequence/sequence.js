import { Address } from 'ox';
import { jsonReplacers, jsonRevivers } from './index.js';
const DB_NAME = 'SequenceDappStorage';
const DB_VERSION = 1;
const STORE_NAME = 'userKeys';
const IMPLICIT_SESSIONS_IDB_KEY = 'SequenceImplicitSession';
const EXPLICIT_SESSIONS_IDB_KEY = 'SequenceExplicitSession';
const SESSIONLESS_CONNECTION_IDB_KEY = 'SequenceSessionlessConnection';
const PENDING_REDIRECT_REQUEST_KEY = 'SequencePendingRedirect';
const TEMP_SESSION_PK_KEY = 'SequencePendingTempSessionPk';
const PENDING_REQUEST_CONTEXT_KEY = 'SequencePendingRequestContext';
export class WebStorage {
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (event) => reject(`IndexedDB error: ${event.target.error}`);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }
    async getIDBItem(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
            request.onerror = (event) => reject(`Failed to retrieve item: ${event.target.error}`);
            request.onsuccess = (event) => resolve(event.target.result);
        });
    }
    async setIDBItem(key, value) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
            request.onerror = (event) => reject(`Failed to save item: ${event.target.error}`);
            request.onsuccess = () => resolve();
        });
    }
    async deleteIDBItem(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
            request.onerror = (event) => reject(`Failed to delete item: ${event.target.error}`);
            request.onsuccess = () => resolve();
        });
    }
    async setPendingRedirectRequest(isPending) {
        try {
            if (isPending) {
                sessionStorage.setItem(PENDING_REDIRECT_REQUEST_KEY, 'true');
            }
            else {
                sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY);
            }
        }
        catch (error) {
            console.error('Failed to set pending redirect flag:', error);
        }
    }
    async isRedirectRequestPending() {
        try {
            return sessionStorage.getItem(PENDING_REDIRECT_REQUEST_KEY) === 'true';
        }
        catch (error) {
            console.error('Failed to check pending redirect flag:', error);
            return false;
        }
    }
    async saveTempSessionPk(pk) {
        try {
            sessionStorage.setItem(TEMP_SESSION_PK_KEY, pk);
        }
        catch (error) {
            console.error('Failed to save temp session PK:', error);
        }
    }
    async getAndClearTempSessionPk() {
        try {
            const pk = sessionStorage.getItem(TEMP_SESSION_PK_KEY);
            sessionStorage.removeItem(TEMP_SESSION_PK_KEY);
            return pk;
        }
        catch (error) {
            console.error('Failed to retrieve temp session PK:', error);
            return null;
        }
    }
    async savePendingRequest(context) {
        try {
            sessionStorage.setItem(PENDING_REQUEST_CONTEXT_KEY, JSON.stringify(context, jsonReplacers));
        }
        catch (error) {
            console.error('Failed to save pending request context:', error);
        }
    }
    async getAndClearPendingRequest() {
        try {
            const context = sessionStorage.getItem(PENDING_REQUEST_CONTEXT_KEY);
            if (!context)
                return null;
            sessionStorage.removeItem(PENDING_REQUEST_CONTEXT_KEY);
            return JSON.parse(context, jsonRevivers);
        }
        catch (error) {
            console.error('Failed to retrieve pending request context:', error);
            return null;
        }
    }
    async peekPendingRequest() {
        try {
            const context = sessionStorage.getItem(PENDING_REQUEST_CONTEXT_KEY);
            if (!context)
                return null;
            return JSON.parse(context, jsonRevivers);
        }
        catch (error) {
            console.error('Failed to peek at pending request context:', error);
            return null;
        }
    }
    async saveExplicitSession(sessionData) {
        try {
            const existingSessions = (await this.getExplicitSessions()).filter((s) => !(Address.isEqual(s.walletAddress, sessionData.walletAddress) &&
                s.pk === sessionData.pk &&
                s.chainId === sessionData.chainId));
            await this.setIDBItem(EXPLICIT_SESSIONS_IDB_KEY, [...existingSessions, sessionData]);
        }
        catch (error) {
            console.error('Failed to save explicit session:', error);
            throw error;
        }
    }
    async getExplicitSessions() {
        try {
            const sessions = await this.getIDBItem(EXPLICIT_SESSIONS_IDB_KEY);
            return sessions && Array.isArray(sessions) ? sessions : [];
        }
        catch (error) {
            console.error('Failed to retrieve explicit sessions:', error);
            return [];
        }
    }
    async clearExplicitSessions() {
        try {
            await this.deleteIDBItem(EXPLICIT_SESSIONS_IDB_KEY);
        }
        catch (error) {
            console.error('Failed to clear explicit sessions:', error);
            throw error;
        }
    }
    async saveImplicitSession(sessionData) {
        try {
            await this.setIDBItem(IMPLICIT_SESSIONS_IDB_KEY, sessionData);
        }
        catch (error) {
            console.error('Failed to save implicit session:', error);
            throw error;
        }
    }
    async getImplicitSession() {
        try {
            return (await this.getIDBItem(IMPLICIT_SESSIONS_IDB_KEY)) ?? null;
        }
        catch (error) {
            console.error('Failed to retrieve implicit session:', error);
            return null;
        }
    }
    async clearImplicitSession() {
        try {
            await this.deleteIDBItem(IMPLICIT_SESSIONS_IDB_KEY);
        }
        catch (error) {
            console.error('Failed to clear implicit session:', error);
            throw error;
        }
    }
    async saveSessionlessConnection(sessionData) {
        try {
            await this.setIDBItem(SESSIONLESS_CONNECTION_IDB_KEY, sessionData);
        }
        catch (error) {
            console.error('Failed to save sessionless connection:', error);
            throw error;
        }
    }
    async getSessionlessConnection() {
        try {
            return (await this.getIDBItem(SESSIONLESS_CONNECTION_IDB_KEY)) ?? null;
        }
        catch (error) {
            console.error('Failed to retrieve sessionless connection:', error);
            return null;
        }
    }
    async clearSessionlessConnection() {
        try {
            await this.deleteIDBItem(SESSIONLESS_CONNECTION_IDB_KEY);
        }
        catch (error) {
            console.error('Failed to clear sessionless connection:', error);
            throw error;
        }
    }
    async clearAllData() {
        try {
            // Clear all session storage items
            sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY);
            sessionStorage.removeItem(TEMP_SESSION_PK_KEY);
            sessionStorage.removeItem(PENDING_REQUEST_CONTEXT_KEY);
            // Clear all IndexedDB items
            await this.clearExplicitSessions();
            await this.clearImplicitSession();
            await this.clearSessionlessConnection();
        }
        catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    }
}

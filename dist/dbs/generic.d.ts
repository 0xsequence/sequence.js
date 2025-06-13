import { IDBPDatabase, IDBPTransaction } from 'idb';
export type DbUpdateType = 'added' | 'updated' | 'removed';
export type DbUpdateListener<T, K extends keyof T> = (keyValue: T[K], updateType: DbUpdateType, oldItem?: T, newItem?: T) => void;
export type Migration = (db: IDBPDatabase<unknown>, transaction: IDBPTransaction<unknown, string[], 'versionchange'>, event: IDBVersionChangeEvent) => void;
export declare class Generic<T extends {
    [P in K]: IDBValidKey;
}, K extends keyof T> {
    private dbName;
    private storeName;
    private key;
    private migrations;
    private _db;
    private listeners;
    private broadcastChannel?;
    /**
     * @param dbName The name of the IndexedDB database.
     * @param storeName The name of the object store.
     * @param key The property key in T to be used as the primary key.
     * @param migrations An array of migration functions; the database version is migrations.length + 1.
     */
    constructor(dbName: string, storeName: string, key: K, migrations?: Migration[]);
    private openDB;
    protected handleOpenDB(): Promise<void>;
    protected getStore(mode: IDBTransactionMode): Promise<import("idb").IDBPObjectStore<unknown, [string], string, "versionchange" | "readonly" | "readwrite">>;
    get(keyValue: T[K]): Promise<T | undefined>;
    list(): Promise<T[]>;
    set(item: T): Promise<T[K]>;
    del(keyValue: T[K]): Promise<void>;
    private notifyUpdate;
    addListener(listener: DbUpdateListener<T, K>): () => void;
    removeListener(listener: DbUpdateListener<T, K>): void;
    close(): Promise<void>;
}
//# sourceMappingURL=generic.d.ts.map
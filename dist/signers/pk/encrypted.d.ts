import { Address, PublicKey, Bytes } from 'ox';
import { PkStore } from './index.js';
export interface EncryptedData {
    iv: Uint8Array;
    data: ArrayBuffer;
    keyPointer: string;
    address: Address.Address;
    publicKey: PublicKey.PublicKey;
}
export declare class EncryptedPksDb {
    private readonly localStorageKeyPrefix;
    private tableName;
    private dbName;
    private dbVersion;
    constructor(localStorageKeyPrefix?: string, tableName?: string);
    private computeDbKey;
    private openDB;
    private putData;
    private getData;
    private getAllData;
    generateAndStore(): Promise<EncryptedData>;
    getEncryptedEntry(address: Address.Address): Promise<EncryptedData | undefined>;
    getEncryptedPkStore(address: Address.Address): Promise<EncryptedPkStore | undefined>;
    listAddresses(): Promise<Address.Address[]>;
    remove(address: Address.Address): Promise<void>;
}
export declare class EncryptedPkStore implements PkStore {
    private readonly encrypted;
    constructor(encrypted: EncryptedData);
    address(): Address.Address;
    publicKey(): PublicKey.PublicKey;
    signDigest(digest: Bytes.Bytes): Promise<{
        r: bigint;
        s: bigint;
        yParity: number;
    }>;
}
//# sourceMappingURL=encrypted.d.ts.map
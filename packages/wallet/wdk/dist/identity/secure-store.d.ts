export interface SecureStoreBackend {
  get(dbName: string, dbStoreName: string, key: string): Promise<any | null>
  set(dbName: string, dbStoreName: string, key: string, value: any, validUntil: Date): Promise<boolean>
  delete(dbName: string, dbStoreName: string, key: string): Promise<boolean>
}
export declare const getDefaultSecureStoreBackend: () => SecureStoreBackend | null
export declare function isIndexedDbAvailable(): boolean
export declare class LocalStorageSecureStoreBackend implements SecureStoreBackend {
  private storage
  constructor()
  get(dbName: string, dbStoreName: string, key: string): Promise<any | null>
  set(dbName: string, dbStoreName: string, key: string, value: any, validUntil: Date): Promise<boolean>
  delete(dbName: string, dbStoreName: string, key: string): Promise<boolean>
}
//# sourceMappingURL=secure-store.d.ts.map

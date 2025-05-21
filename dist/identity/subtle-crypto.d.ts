export interface SubtleCryptoBackend {
  generateKey(
    algorithm: RsaHashedKeyGenParams | EcKeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKeyPair>
  importKey(
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: ReadonlyArray<KeyUsage>,
  ): Promise<CryptoKey>
  exportKey(format: Exclude<KeyFormat, 'jwk'>, key: CryptoKey): Promise<Uint8Array>
  digest(algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<Uint8Array>
  sign(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    data: Uint8Array,
  ): Promise<Uint8Array>
  verify(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean>
  getRandomValues(len: number): Uint8Array
}
export declare const getDefaultSubtleCryptoBackend: () => SubtleCryptoBackend | undefined
export declare function isWindowSubtleCryptoAvailable(): boolean
export declare class WindowSubtleCryptoBackend implements SubtleCryptoBackend {
  constructor()
  generateKey(
    algorithm: RsaHashedKeyGenParams | EcKeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKeyPair>
  importKey(
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: ReadonlyArray<KeyUsage>,
  ): Promise<CryptoKey>
  exportKey(format: Exclude<KeyFormat, 'jwk'>, key: CryptoKey): Promise<Uint8Array>
  digest(algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<Uint8Array>
  sign(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    data: Uint8Array,
  ): Promise<Uint8Array>
  verify(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean>
  getRandomValues(len: number): Uint8Array<ArrayBuffer>
}
//# sourceMappingURL=subtle-crypto.d.ts.map

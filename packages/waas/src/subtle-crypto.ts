export interface SubtleCryptoBackend {
  // generateKey is used to generate a new key pair. NOTE: its important to pass
  // `false` to the extractable argument to ensure that the private key contents
  // cannot be revealed. Note, that you can still use `extractable:false` and the
  // `exportKey(..)` method, because the Browser is smart enough to keep the key
  // opaque and only allow it to be exported in a wrapped format without revealing
  // the private key contents.
  generateKey(
    algorithm: RsaHashedKeyGenParams | EcKeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKeyPair>

  importKey(
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: ReadonlyArray<KeyUsage>
  ): Promise<CryptoKey>

  // exportKey is used to export a key pair. The `format` argument is used to
  // specify the format of the exported key. The `key` argument is the key pair
  // to export. In general we'll use `format: 'raw'` and `key: <public-key>`.
  // Contents will be opaque when `extractable: false` was passed to `generateKey(..)`.
  exportKey(format: Exclude<KeyFormat, 'jwk'>, key: CryptoKey): Promise<Uint8Array>

  // digest is used to hash a message. The `algorithm` argument is used to specify
  // the hash algorithm to use. The `data` argument is the message to hash.
  digest(algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<Uint8Array>

  // sign is used to sign a message. The `algorithm` argument is used to specify
  // the signing algorithm to use. The `key` argument is the private key to use
  // for signing. The `data` argument is the message to sign.
  //
  // For our purposes we just care about ECDSA / P-256.
  sign(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, data: Uint8Array): Promise<Uint8Array>

  // verify is used to verify a signature. The `algorithm` argument is used to
  // specify the verification algorithm to use. The `key` argument is the public
  // key to use for verification. The `signature` argument is the signature to
  // verify. The `data` argument is the message to verify.
  verify(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean>

  // getRandomValues is used to generate random bytes. The `len` argument is the
  // number of random bytes to generate.
  getRandomValues(len: number): Uint8Array
}

export const getDefaultSubtleCryptoBackend = (): SubtleCryptoBackend | null => {
  if (isWindowSubtleCryptoAvailable()) {
    return new WindowSubtleCryptoBackend()
  } else {
    return null
  }
}

export function isWindowSubtleCryptoAvailable(): boolean {
  return typeof window === 'object' && typeof window.crypto === 'object' && typeof window.crypto.subtle === 'object'
}

export class WindowSubtleCryptoBackend implements SubtleCryptoBackend {
  constructor() {
    if (!isWindowSubtleCryptoAvailable()) {
      throw new Error('window.crypto.subtle is not available')
    }
  }

  generateKey(
    algorithm: RsaHashedKeyGenParams | EcKeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKeyPair> {
    return window.crypto.subtle.generateKey(algorithm, extractable, keyUsages)
  }

  importKey(
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: ReadonlyArray<KeyUsage>
  ): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(format, keyData, algorithm, extractable, keyUsages)
  }

  async exportKey(format: Exclude<KeyFormat, 'jwk'>, key: CryptoKey): Promise<Uint8Array> {
    const keyData = await window.crypto.subtle.exportKey(format, key)
    return new Uint8Array(keyData)
  }

  async digest(algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<Uint8Array> {
    const digest = await window.crypto.subtle.digest(algorithm, data)
    return new Uint8Array(digest)
  }

  async sign(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const signature = await window.crypto.subtle.sign(algorithm, key, data)
    return new Uint8Array(signature)
  }

  verify(
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean> {
    return window.crypto.subtle.verify(algorithm, key, signature, data)
  }

  getRandomValues(len: number) {
    const randomValues = new Uint8Array(len)
    return window.crypto.getRandomValues(randomValues)
  }
}

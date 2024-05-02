import { newSECP256K1SessionFromSessionId, newSECP256K1Session } from './secp256k1'
import { newSECP256R1SessionFromSessionId, newSECP256R1Session } from './secp256r1'
import { SubtleCryptoBackend } from '../subtle-crypto'
import { SecureStoreBackend } from '../secure-store'

export type Session = {
  sessionId(): Promise<string>
  sign(message: string | Uint8Array): Promise<string>
  clear(): void
}

export async function newSessionFromSessionId(
  sessionId: string,
  cryptoBackend: SubtleCryptoBackend | null,
  secureStoreBackend: SecureStoreBackend | null
): Promise<Session> {
  if (!secureStoreBackend) {
    throw new Error('No secure store available')
  }
  if (cryptoBackend) {
    return newSECP256R1SessionFromSessionId(sessionId, cryptoBackend, secureStoreBackend)
  } else {
    return newSECP256K1SessionFromSessionId(sessionId, secureStoreBackend)
  }
}

export async function newSession(
  cryptoBackend: SubtleCryptoBackend | null,
  secureStoreBackend: SecureStoreBackend | null
): Promise<Session> {
  if (!secureStoreBackend) {
    throw new Error('No secure store available')
  }
  if (cryptoBackend) {
    return newSECP256R1Session(cryptoBackend, secureStoreBackend)
  } else {
    return newSECP256K1Session(secureStoreBackend)
  }
}

export * from './secp256r1'
export * from './secp256k1'

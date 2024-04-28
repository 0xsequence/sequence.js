import { newSECP256K1SessionFromSessionId, newSECP256K1Session } from './secp256k1'
import { newSECP256R1SessionFromSessionId, newSECP256R1Session } from './secp256r1'
import { SubtleCryptoBackend } from '../subtle-crypto'

export type Session = {
  sessionId(): Promise<string>
  sign(message: string | Uint8Array): Promise<string>
  clear(): void
}

export async function newSessionFromSessionId(sessionId: string, cryptoBackend: SubtleCryptoBackend | null): Promise<Session> {
  if (cryptoBackend) {
    return newSECP256R1SessionFromSessionId(sessionId, cryptoBackend)
  } else {
    return newSECP256K1SessionFromSessionId(sessionId)
  }
}

export async function newSession(cryptoBackend: SubtleCryptoBackend | null): Promise<Session> {
  if (cryptoBackend) {
    return newSECP256R1Session(cryptoBackend)
  } else {
    return newSECP256K1Session()
  }
}

export * from './secp256r1'
export * from './secp256k1'

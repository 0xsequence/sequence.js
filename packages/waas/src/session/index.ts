import { newSECP256K1SessionFromSessionId, newSECP256K1Session } from './secp256k1'
import { newSECP256R1SessionFromSessionId, newSECP256R1Session } from './secp256r1'

export type Session = {
  sessionId(): Promise<string>
  sign(message: string | Uint8Array): Promise<string>
  clear(): void
}

export async function newSessionFromSessionId(sessionId: string): Promise<Session> {
  if (isSubtleCryptoAvailable()) {
    return newSECP256R1SessionFromSessionId(sessionId)
  } else {
    return newSECP256K1SessionFromSessionId(sessionId)
  }
}

export async function newSession(): Promise<Session> {
  if (isSubtleCryptoAvailable()) {
    return newSECP256R1Session()
  } else {
    return newSECP256K1Session()
  }
}

export function isSubtleCryptoAvailable(): boolean {
  return typeof window === 'object' && typeof window.crypto === 'object' && typeof window.crypto.subtle === 'object'
}

export * from './secp256r1'
export * from './secp256k1'

import { Intent as RawIntent } from '../clients/intent.gen'
import { useLifespan } from './utils'
import { ethers } from 'ethers'
import { canonicalize } from 'json-canonicalize'
import { Session } from '../session'

export type Intent<T> = Omit<RawIntent, 'data' | 'signatures'> & { data: T }
export type SignedIntent<T> = Omit<RawIntent, 'data'> & { data: T }

const VERSION = '0.0.0'

export function makeIntent<T>(name: string, lifespan: number, data: T): Intent<T> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + lifespan
  return {
    version: VERSION,
    issuedAt,
    expiresAt,
    name,
    data
  }
}

export async function signIntent<T>(session: Session, intent: Intent<T>): Promise<SignedIntent<T>> {
  const hash = hashIntent(intent)
  const signature = await session.sign(new Uint8Array(hash))
  return {
    ...intent,
    signatures: [
      {
        sessionId: await session.sessionId(),
        signature
      }
    ]
  }
}

export function hashIntent<T>(intent: Intent<T>): ethers.Bytes {
  // Discard all fields other than the explicitly listed
  const { version, issuedAt, expiresAt, name, data } = intent
  const hashableIntent = { version, issuedAt, expiresAt, name, data }
  const encoded = ethers.utils.toUtf8Bytes(canonicalize(hashableIntent))
  return ethers.utils.arrayify(ethers.utils.keccak256(encoded))
}

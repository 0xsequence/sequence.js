import { VERSION as PACKAGE_VERSION } from '@0xsequence/core'
import { Intent as RawIntent, IntentName } from '../clients/intent.gen'
import { useLifespan } from './utils'
import { ethers } from 'ethers'
import { canonicalize } from 'json-canonicalize'
import { Session } from '../session'

export type Intent<T> = Omit<RawIntent, 'data' | 'signatures'> & { data: T }
export type SignedIntent<T> = Omit<RawIntent, 'data'> & { data: T }

const INTENTS_VERSION = 1
const VERSION = `${INTENTS_VERSION} (Web ${PACKAGE_VERSION})`

// The result of localTime - serverTime, in seconds
let timeDrift: number | undefined

export function getTimeDrift() {
  return timeDrift
}

export function updateTimeDrift(serverTime: Date) {
  timeDrift = (Date.now() - serverTime.getTime()) / 1000
}

export function makeIntent<T>(name: IntentName, lifespan: number, data: T): Intent<T> {
  const drift = Math.abs(Math.floor(timeDrift || 0))
  const issuedAt = Math.floor(Date.now() / 1000 - drift)
  const expiresAt = issuedAt + lifespan + 2*drift
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

export function hashIntent<T>(intent: Intent<T>): Uint8Array {
  // Discard all fields other than the explicitly listed
  const { version, issuedAt, expiresAt, name, data } = intent
  const hashableIntent = { version, issuedAt, expiresAt, name, data }
  const encoded = ethers.toUtf8Bytes(canonicalize(hashableIntent))
  return ethers.getBytes(ethers.keccak256(encoded))
}

export function changeIntentTime<T>(intent: SignedIntent<T>, now: Date): Intent<T> {
  const { signatures, ...unsignedIntent } = intent
  const lifespan = intent.expiresAt - intent.issuedAt
  unsignedIntent.issuedAt = Math.floor(now.getTime() / 1000)
  unsignedIntent.expiresAt = unsignedIntent.issuedAt + lifespan
  return unsignedIntent
}

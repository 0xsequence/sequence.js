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

let timeDrift: number | undefined
const timeDriftKey = '@sequence.timeDrift'

function isSessionStorageAvailable() {
  return typeof window === 'object' && typeof window.sessionStorage === 'object'
}

export function getLocalTime() {
  return new Date().getTime()
}

export function getTimeDrift() {
  if (isSessionStorageAvailable()) {
    const drift = window.sessionStorage.getItem(timeDriftKey)
    if (drift) {
      return parseInt(drift, 10)
    }
  }
  return timeDrift
}

export function updateTimeDrift(serverTime?: Date) {
  if (!serverTime) {
    timeDrift = undefined
    if (isSessionStorageAvailable()) {
      window.sessionStorage.removeItem(timeDriftKey)
    }
    return
  }

  timeDrift = (getLocalTime() - serverTime.getTime()) / 1000
  if (isSessionStorageAvailable()) {
    window.sessionStorage.setItem(timeDriftKey, timeDrift.toString(10))
  }
}

export function makeIntent<T>(name: IntentName, lifespan: number, data: T): Intent<T> {
  const drift = Math.abs(Math.floor(getTimeDrift() || 0))
  const issuedAt = Math.floor(getLocalTime() / 1000 - drift)
  const expiresAt = issuedAt + lifespan + 2 * drift
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

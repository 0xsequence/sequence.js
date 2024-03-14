import { ethers } from 'ethers'
import { Session } from './index'
import { KeyTypes } from './keyTypes'

import { openDB } from 'idb'

const idbName = 'seq-waas-session-p256r1'
const idbStoreName = 'seq-waas-session'

export async function newSECP256R1SessionFromSessionId(sessionId: string): Promise<Session> {
  const db = await openDB(idbName)

  const tx = db.transaction(idbStoreName, 'readonly')
  const keys = await db.get(idbStoreName, sessionId)
  await tx.done

  const encoder = new TextEncoder()
  return {
    sessionId: async () => {
      const pubKeyRaw = await window.crypto.subtle.exportKey('raw', keys.publicKey)
      const pubKeyTypedRaw = new Uint8Array(pubKeyRaw.byteLength + 1)

      // set the first byte to the key type
      pubKeyTypedRaw[0] = KeyTypes.ECDSAP256R1
      pubKeyTypedRaw.set(new Uint8Array(pubKeyRaw), 1)

      return ethers.utils.hexlify(pubKeyTypedRaw)
    },
    sign: async (message: string | Uint8Array) => {
      if (typeof message === 'string') {
        if (message.startsWith('0x')) {
          message = message.slice(2)
          message = ethers.utils.arrayify(message)
        } else {
          message = encoder.encode(message)
        }
      }
      const signatureBuff = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keys.privateKey,
        message
      )
      return ethers.utils.hexlify(new Uint8Array(signatureBuff))
    },
    clear: async () => {
      await db.delete(idbStoreName, sessionId)
    }
  }
}

export async function newSECP256R1SessionFromKeyPair(keyPair: CryptoKeyPair): Promise<Session> {
  const sessionId = await pubKeyToSessionId(keyPair.publicKey)

  const db = await openDB(idbName, 1, {
    upgrade(db) {
      db.createObjectStore(idbStoreName)
    }
  })

  const tx = db.transaction(idbStoreName, 'readwrite')
  await db.put(idbStoreName, keyPair, sessionId)
  await tx.done

  db.close()

  return newSECP256R1SessionFromSessionId(sessionId)
}

export async function newSECP256R1Session(): Promise<Session> {
  const generatedKeys = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign', 'verify']
  )
  return newSECP256R1SessionFromKeyPair(generatedKeys)
}

async function pubKeyToSessionId(pubKey: CryptoKey): Promise<string> {
  const pubKeyRaw = await window.crypto.subtle.exportKey('raw', pubKey)
  const pubKeyTypedRaw = new Uint8Array(pubKeyRaw.byteLength + 1)

  // set the first byte to the key type
  pubKeyTypedRaw[0] = KeyTypes.ECDSAP256R1
  pubKeyTypedRaw.set(new Uint8Array(pubKeyRaw), 1)

  return ethers.utils.hexlify(pubKeyTypedRaw)
}

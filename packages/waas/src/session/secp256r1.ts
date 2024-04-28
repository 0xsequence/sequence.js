import { ethers } from 'ethers'
import { Session } from './index'
import { KeyTypes } from './keyTypes'
import { SubtleCryptoBackend } from '../subtle-crypto'

import { openDB } from 'idb'
import { SecureStoreBackend } from '../secure-store'

const idbName = 'seq-waas-session-p256r1'
const idbStoreName = 'seq-waas-session'

// TODO: in order to support react-native we will have to create
// an adapter for idb here for storage, and anywhere else 'idb' is used
// in the entire project.

export async function newSECP256R1SessionFromSessionId(sessionId: string, cryptoBackend: SubtleCryptoBackend, secureStoreBackend: SecureStoreBackend): Promise<Session> {
  const db = await openDB(idbName)

  const tx = db.transaction(idbStoreName, 'readonly')
  const keys = await db.get(idbStoreName, sessionId)
  await tx.done

  const encoder = new TextEncoder()
  return {
    sessionId: async () => {
      const pubKeyRaw = await cryptoBackend.exportKey('raw', keys.publicKey)
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
      const signatureBuff = await cryptoBackend.sign(
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

export async function newSECP256R1SessionFromKeyPair(keyPair: CryptoKeyPair, cryptoBackend: SubtleCryptoBackend, secureStoreBackend: SecureStoreBackend): Promise<Session> {
  const sessionId = await pubKeyToSessionId(cryptoBackend, keyPair.publicKey)

  const db = await openDB(idbName, 1, {
    upgrade(db) {
      db.createObjectStore(idbStoreName)
    }
  })

  const tx = db.transaction(idbStoreName, 'readwrite')
  await db.put(idbStoreName, keyPair, sessionId)
  await tx.done

  db.close()

  return newSECP256R1SessionFromSessionId(sessionId, cryptoBackend, secureStoreBackend)
}

export async function newSECP256R1Session(cryptoBackend: SubtleCryptoBackend, secureStoreBackend: SecureStoreBackend): Promise<Session> {
  const generatedKeys = await cryptoBackend.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign', 'verify']
  )
  return newSECP256R1SessionFromKeyPair(generatedKeys, cryptoBackend, secureStoreBackend)
}

async function pubKeyToSessionId(cryptoBackend: SubtleCryptoBackend, pubKey: CryptoKey): Promise<string> {
  const pubKeyRaw = await cryptoBackend.exportKey('raw', pubKey)
  const pubKeyTypedRaw = new Uint8Array(pubKeyRaw.byteLength + 1)

  // set the first byte to the key type
  pubKeyTypedRaw[0] = KeyTypes.ECDSAP256R1
  pubKeyTypedRaw.set(new Uint8Array(pubKeyRaw), 1)

  return ethers.utils.hexlify(pubKeyTypedRaw)
}

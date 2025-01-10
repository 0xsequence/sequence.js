import { ethers } from 'ethers'
import { Session } from './index'
import { KeyTypes } from './keyTypes'
import { SubtleCryptoBackend } from '../subtle-crypto'
import { SecureStoreBackend } from '../secure-store'
import { NoPrivateKeyError } from '../errors'

const idbName = 'seq-waas-session-p256r1'
const idbStoreName = 'seq-waas-session'

// TODO: We need to update this to use the secure store backend
// Currently it ignores the override and leverages idb
// This is because the CryptoKeyPair is a bit more complicated
// than a simple string that SecureStoreBackend can handle

export async function newSECP256R1SessionFromSessionId(
  sessionId: string,
  cryptoBackend: SubtleCryptoBackend,
  secureStoreBackend: SecureStoreBackend
): Promise<Session> {
  const keys = await secureStoreBackend.get(idbName, idbStoreName, sessionId)

  if (!keys || !keys.privateKey) {
    throw new NoPrivateKeyError()
  }

  const encoder = new TextEncoder()
  return {
    sessionId: async () => {
      const pubKeyRaw = await cryptoBackend.exportKey('raw', keys.publicKey)
      const pubKeyTypedRaw = new Uint8Array(pubKeyRaw.byteLength + 1)

      // set the first byte to the key type
      pubKeyTypedRaw[0] = KeyTypes.ECDSAP256R1
      pubKeyTypedRaw.set(new Uint8Array(pubKeyRaw), 1)

      return ethers.hexlify(pubKeyTypedRaw)
    },
    sign: async (message: string | Uint8Array) => {
      if (typeof message === 'string') {
        if (message.startsWith('0x')) {
          message = message.slice(2)
          message = ethers.getBytes(message)
        } else {
          message = encoder.encode(message)
        }
      }
      const signatureBuff = await cryptoBackend.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, keys.privateKey, message)
      return ethers.hexlify(new Uint8Array(signatureBuff))
    },
    clear: async () => {
      await secureStoreBackend.delete(idbName, idbStoreName, sessionId)
    }
  }
}

export async function newSECP256R1SessionFromKeyPair(
  keyPair: CryptoKeyPair,
  cryptoBackend: SubtleCryptoBackend,
  secureStoreBackend: SecureStoreBackend
): Promise<Session> {
  const sessionId = await pubKeyToSessionId(cryptoBackend, keyPair.publicKey)

  await secureStoreBackend.set(idbName, idbStoreName, sessionId, keyPair)

  return newSECP256R1SessionFromSessionId(sessionId, cryptoBackend, secureStoreBackend)
}

export async function newSECP256R1Session(
  cryptoBackend: SubtleCryptoBackend,
  secureStoreBackend: SecureStoreBackend
): Promise<Session> {
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

  return ethers.hexlify(pubKeyTypedRaw)
}

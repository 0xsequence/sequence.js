import { ethers } from 'ethers'
import { SecureStoreBackend } from '../secure-store'
import { Session } from './index'
import { NoPrivateKeyError } from '../errors'

const idbName = 'seq-waas-session-p256k1'
const idbStoreName = 'seq-waas-session'

export async function newSECP256K1SessionFromSessionId(
  sessionId: string,
  secureStoreBackend: SecureStoreBackend
): Promise<Session> {
  const privateKey = await secureStoreBackend.get(idbName, idbStoreName, sessionId)

  if (!privateKey) {
    throw new NoPrivateKeyError()
  }

  const wallet = new ethers.Wallet(privateKey)

  return {
    sessionId(): Promise<string> {
      return wallet.getAddress()
    },
    sign(message: string | Uint8Array): Promise<string> {
      return wallet.signMessage(message)
    },
    clear: async () => {
      await secureStoreBackend.delete(idbName, idbStoreName, sessionId)
    }
  } as Session
}

export async function newSECP256K1SessionFromPrivateKey(
  privateKey: string,
  secureStoreBackend: SecureStoreBackend
): Promise<Session> {
  const wallet = new ethers.Wallet(privateKey)
  const sessionId = await wallet.getAddress()

  await secureStoreBackend.set(idbName, idbStoreName, sessionId, privateKey)

  return newSECP256K1SessionFromSessionId(sessionId, secureStoreBackend)
}

export async function newSECP256K1Session(secureStoreBackend: SecureStoreBackend): Promise<Session> {
  const wallet = ethers.Wallet.createRandom()
  return newSECP256K1SessionFromPrivateKey(wallet.privateKey, secureStoreBackend)
}

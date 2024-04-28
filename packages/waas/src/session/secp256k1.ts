import { ethers } from 'ethers'
import { getDefaultSecureStoreBackend } from '../secure-store'
import { Session } from './index'

const idbName = 'seq-waas-session-p256k1'
const idbStoreName = 'seq-waas-session'

export async function newSECP256K1SessionFromSessionId(sessionId: string): Promise<Session> {
  const secureStore = getDefaultSecureStoreBackend()
  if (!secureStore) {
    throw new Error('No secure store available')
  }

  const privateKey = await secureStore.get(idbName, idbStoreName, sessionId)

  if (!privateKey) {
    throw new Error('No private key found')
  }

  const wallet = new ethers.Wallet(privateKey)

  return {
    sessionId(): Promise<string> {
      return wallet.getAddress()
    },
    sign(message: string | Uint8Array): Promise<string> {
      return wallet.signMessage(message)
    },
    clear(): void {
      secureStore.delete(idbName, idbStoreName, sessionId)
    }
  } as Session
}

export async function newSECP256K1SessionFromPrivateKey(privateKey: string): Promise<Session> {
  const wallet = new ethers.Wallet(privateKey)

  const secureStore = getDefaultSecureStoreBackend()
  if (!secureStore) {
    throw new Error('No secure store available')
  }

  const sessionId = await wallet.getAddress()

  await secureStore.set(idbName, idbStoreName, sessionId, privateKey)

  return newSECP256K1SessionFromSessionId(sessionId)
}

export async function newSECP256K1Session(): Promise<Session> {
  const wallet = ethers.Wallet.createRandom()
  return newSECP256K1SessionFromPrivateKey(wallet.privateKey)
}

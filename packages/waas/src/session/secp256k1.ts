import { ethers } from 'ethers'
import { openDB } from 'idb'
import { Session } from './index'

const idbName = 'seq-waas-session-p256k1'
const idbStoreName = 'seq-waas-session'

export async function newSECP256K1SessionFromSessionId(sessionId: string): Promise<Session> {
  const db = await openDB(idbName)

  const tx = db.transaction(idbStoreName, 'readonly')
  const privateKey = await db.get(idbStoreName, sessionId)
  await tx.done

  const wallet = new ethers.Wallet(privateKey)

  return {
    sessionId(): Promise<string> {
      return wallet.getAddress()
    },
    sign(message: string | Uint8Array): Promise<string> {
      return wallet.signMessage(message)
    },
    clear(): void {
      db.delete(idbStoreName, sessionId)
    }
  } as Session
}

export async function newSECP256K1SessionFromPrivateKey(privateKey: string): Promise<Session> {
  const wallet = new ethers.Wallet(privateKey)

  const db = await openDB(idbName, 1, {
    upgrade(db) {
      db.createObjectStore(idbStoreName)
    }
  })

  const sessionId = await wallet.getAddress()

  const tx = db.transaction(idbStoreName, 'readwrite')
  await db.put(idbStoreName, privateKey, sessionId)
  await tx.done

  db.close()

  return newSECP256K1SessionFromSessionId(sessionId)
}

export async function newSECP256K1Session(): Promise<Session> {
  const wallet = ethers.Wallet.createRandom()
  return newSECP256K1SessionFromPrivateKey(wallet.privateKey)
}

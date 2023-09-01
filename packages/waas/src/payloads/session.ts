
import { ethers } from 'ethers'

export type SessionPayload = {
  signer: string;
}

export type SessionReceipt = {
  signer: string;
  wallet: string;
}

export function isSessionPayload(payload: any): payload is SessionPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.signer === 'string' &&
    typeof payload.idToken === 'string' &&
    ethers.utils.isAddress(payload.signer)
  )
}

export function isSessionReceipt(receipt: any): receipt is SessionReceipt {
  return (
    typeof receipt === 'object' &&
    typeof receipt.signer === 'string' &&
    typeof receipt.wallet === 'string' &&
    ethers.utils.isAddress(receipt.signer) &&
    ethers.utils.isAddress(receipt.wallet)
  )
}

export async function openSession(): Promise<{ payload: SessionPayload, signer: ethers.Wallet }> {
  const signer = ethers.Wallet.createRandom()

  return {
    signer,
    payload: {
      signer: signer.address
    }
  }
}

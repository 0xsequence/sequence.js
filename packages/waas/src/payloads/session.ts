
import { ethers } from 'ethers'
import { BasePacket } from '.'

export type SessionPacket = BasePacket & {
  code: 'openSession'
  signer: string;
  proof: {
    email?: string;
    idToken?: string;
  }
}

export type SessionReceipt = {
  signer: string;
  wallet: string;
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

export async function openSession(): Promise<{ packet: SessionPacket, signer: ethers.Wallet }> {
  const signer = ethers.Wallet.createRandom()

  return {
    signer,
    packet: {
      code: 'openSession',
      signer: signer.address,
      proof: {} // Will be added server-side
    },
  }
}

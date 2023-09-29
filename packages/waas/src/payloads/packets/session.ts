
import { ethers } from 'ethers'
import { BasePacket } from '..'

export type SessionPacket = BasePacket & {
  code: 'openSession'
  session: string;
  proof: {
    email?: string;
    idToken?: string;
  }
}

export type ValidateSessionPacket = BasePacket & {
  code: 'validateSession',
  session: string
}

export async function openSession(): Promise<{ packet: SessionPacket, signer: ethers.Wallet }> {
  const signer = ethers.Wallet.createRandom()

  return {
    signer,
    packet: {
      code: 'openSession',
      session: signer.address,
      proof: {} // Will be added server-side
    },
  }
}

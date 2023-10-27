
import { ethers } from 'ethers'
import { BasePacket } from '..'

export type SessionPacketProof = {
  email?: string;
  idToken?: string;
}

export type SessionPacket = BasePacket & {
  code: 'openSession'
  session: string;
  proof: SessionPacketProof
}

export type ValidateSessionPacket = BasePacket & {
  code: 'validateSession',
  session: string
}

export async function openSession(proof: SessionPacketProof = {}): Promise<{ packet: SessionPacket, signer: ethers.Wallet }> {
  const signer = ethers.Wallet.createRandom()

  return {
    signer,
    packet: {
      code: 'openSession',
      session: signer.address,
      proof // May be defined server side
    },
  }
}

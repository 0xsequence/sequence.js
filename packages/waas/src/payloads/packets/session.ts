
import { ethers } from 'ethers'
import { BasePacket } from '..'
import { useLifespan } from './utils'

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
  deviceMetadata: string,
  redirectURL: string,
}

export async function openSession({
  proof = {},
  lifespan
}: {
  proof: SessionPacketProof | undefined,
  lifespan: number
}): Promise<{ packet: SessionPacket, signer: ethers.Wallet }> {
  const signer = ethers.Wallet.createRandom()

  return {
    signer,
    packet: {
      ...useLifespan(lifespan),
      code: 'openSession',
      session: signer.address,
      proof // May be defined server side
    },
  }
}

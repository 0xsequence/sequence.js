import { ethers } from 'ethers'
import { BasePacket, BasePacketForWallet } from '..'
import { useLifespan } from './utils'

export type SessionPacketProof = {
  email?: string
  idToken?: string
}

export type OpenSessionPacket = BasePacket & {
  code: 'openSession'
  session: string
  proof: SessionPacketProof
}

export type ValidateSessionPacket = BasePacketForWallet & {
  code: 'validateSession'
  session: string
  deviceMetadata: string
  redirectURL?: string
}

export type FinishValidateSessionPacket = BasePacketForWallet & {
  code: 'finishValidateSession'
  session: string
  salt: string
  challenge: string
}

export type GetSessionPacket = BasePacketForWallet & {
  code: 'getSession'
  session: string
}

export async function openSession({
  signer,
  proof = {},
  lifespan
}: {
  signer: ethers.Signer
  proof: SessionPacketProof | undefined
  lifespan: number
}): Promise<OpenSessionPacket> {

  return {
    ...useLifespan(lifespan),
    code: 'openSession',
    session: await signer.getAddress(),
    proof // May be defined server side
  }
}

export type CloseSessionPacket = BasePacketForWallet & {
  code: 'closeSession'
  session: string
}

export async function closeSession({
  session,
  wallet,
  lifespan
}: {
  session: string
  wallet: string
  lifespan: number
}): Promise<CloseSessionPacket> {
  return {
    ...useLifespan(lifespan),
    code: 'closeSession',
    wallet,
    session
  }
}

export async function validateSession(
  args: {
    wallet: string
    session: string
    deviceMetadata: string
    redirectURL?: string
  } & { lifespan: number }
): Promise<ValidateSessionPacket> {
  return {
    ...useLifespan(args.lifespan),
    ...args,
    code: 'validateSession'
  }
}

export function finishValidateSession(
  wallet: string,
  session: string,
  salt: string,
  challenge: string,
  lifespan: number
): FinishValidateSessionPacket {
  return {
    ...useLifespan(lifespan),
    wallet: wallet,
    session: session,
    code: 'finishValidateSession',
    salt: salt,
    challenge: challenge
  }
}

export async function getSession(
  args: {
    wallet: string
    session: string
  } & { lifespan: number }
): Promise<GetSessionPacket> {
  return {
    ...useLifespan(args.lifespan),
    ...args,
    code: 'getSession'
  }
}

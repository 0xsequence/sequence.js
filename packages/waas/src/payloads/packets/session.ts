import { BasePacket, BasePacketForWallet } from '..'
import { PayloadSigner, newRandomPayloadSigner } from "../signers";
import { useLifespan } from './utils'

export type SessionPacketProof = {
  email?: string
  idToken?: string
}

export type OpenSessionPacket = BasePacket & {
  code: 'openSession'
  sessionVerifier: string
  proof: SessionPacketProof
}

export type ValidateSessionPacket = BasePacketForWallet & {
  code: 'validateSession'
  sessionId: string
  deviceMetadata: string
  redirectURL?: string
}

export type FinishValidateSessionPacket = BasePacketForWallet & {
  code: 'finishValidateSession'
  sessionId: string
  salt: string
  challenge: string
}

export type GetSessionPacket = BasePacketForWallet & {
  code: 'getSession'
  sessionId: string
}

export async function openSession({
  proof = {},
  lifespan
}: {
  proof: SessionPacketProof | undefined
  lifespan: number
}): Promise<{ packet: OpenSessionPacket; signer: PayloadSigner }> {
  const signer = await newRandomPayloadSigner()

  return {
    signer,
    packet: {
      ...useLifespan(lifespan),
      code: 'openSession',
      sessionVerifier: await signer.verifier(),
      proof // May be defined server side
    }
  }
}

export type CloseSessionPacket = BasePacketForWallet & {
  code: 'closeSession'
  sessionId: string
}

export async function closeSession({
  sessionId,
  wallet,
  lifespan
}: {
  sessionId: string
  wallet: string
  lifespan: number
}): Promise<CloseSessionPacket> {
  return {
    ...useLifespan(lifespan),
    code: 'closeSession',
    wallet,
    sessionId
  }
}

export async function validateSession(
  args: {
    wallet: string
    sessionId: string
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
  sessionId: string,
  salt: string,
  challenge: string,
  lifespan: number
): FinishValidateSessionPacket {
  return {
    ...useLifespan(lifespan),
    wallet: wallet,
    sessionId: sessionId,
    code: 'finishValidateSession',
    salt: salt,
    challenge: challenge
  }
}

export async function getSession(
  args: {
    wallet: string
    sessionId: string
  } & { lifespan: number }
): Promise<GetSessionPacket> {
  return {
    ...useLifespan(args.lifespan),
    ...args,
    code: 'getSession'
  }
}

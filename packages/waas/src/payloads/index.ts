import { ethers } from "ethers"
import { canonicalize } from 'json-canonicalize'
import { Session } from "../session";

export type BasePacket = {
  code: string
  issued: number
  expires: number
}

export type BasePacketForWallet = BasePacket & {
  wallet: string
}

export type Signature = {
  sessionId: string,
  signature: string
}

export type Payload<T extends BasePacket> = {
  version: string,
  packet: T,
  signatures: Signature[]
}

export function hashPacket(packet: Payload<BasePacket> | BasePacket): ethers.Bytes {
  if ('version' in packet) {
    packet = packet.packet
  }

  const encoded = ethers.utils.toUtf8Bytes(canonicalize(packet))
  return ethers.utils.arrayify(ethers.utils.keccak256(encoded))
}

// todo: use generic signer interface
export function signPacket(session: Session, packed: BasePacket): Promise<string> {
  const hash = hashPacket(packed)
  return session.sign(new Uint8Array(hash))
}

export * as packets from './packets'
export * as responses from './responses'

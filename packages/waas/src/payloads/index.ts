import { ethers } from "ethers"
import { canonicalize } from 'json-canonicalize'

export type BasePacket = {
  code: string
}

export type Signature = {
  session: string,
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

export function signPacket(signer: ethers.Signer, packed: BasePacket): Promise<string> {
  const hash = hashPacket(packed)
  return signer.signMessage(hash)
}

export * as packets from './packets'

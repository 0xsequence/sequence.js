import { ethers } from "ethers"

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

export function signPacket(signer: ethers.Signer, packed: BasePacket): Promise<string> {
  const encoded = ethers.utils.toUtf8Bytes(JSON.stringify(packed, null, 0))
  return signer.signMessage(encoded)
}

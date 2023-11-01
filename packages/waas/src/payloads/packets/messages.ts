import { ethers } from "ethers"
import { BasePacket } from ".."
import { useLifespan } from "./utils"

export type SignMessagePacket = BasePacket & {
  wallet: string;
  network: string;

  message: string
}

export type SignMessageArgs = {
  chainId: number,
  message: string,
}

export function signMessage({
  wallet,
  chainId,
  message,
  lifespan
}: SignMessageArgs & {
  wallet: string,
  lifespan: number
}): SignMessagePacket {
  return {
    ...useLifespan(lifespan),
    code: 'signMessage',
    wallet: wallet,
    network: chainId.toString(),
    message: message.startsWith('0x') ?
        message : ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))
  }
}

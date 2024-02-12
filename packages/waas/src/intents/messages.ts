import { ethers } from "ethers"
import { IntentDataSignMessage } from "../clients/intent.gen"
import { Intent, makeIntent } from "./base"

export type SignMessageArgs = {
  chainId: number,
  message: string,
  wallet: string,
  lifespan: number,
}

export function signMessage({
  wallet,
  chainId,
  message,
  lifespan
}: SignMessageArgs): Intent<IntentDataSignMessage> {
  return makeIntent('signMessage', lifespan, {
    wallet,
    network: chainId.toString(),
    message: message.startsWith('0x') ?
        message : ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))
  })
}

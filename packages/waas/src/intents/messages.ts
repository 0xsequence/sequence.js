import { ethers } from 'ethers'
import { IntentDataSignMessage, IntentName } from '../clients/intent.gen'
import { Intent, makeIntent } from './base'

interface BaseArgs {
  lifespan: number
  wallet: string
  chainId: number
}

export type SignMessageArgs = {
  message: string
}

export function signMessage({ wallet, chainId, message, lifespan }: SignMessageArgs & BaseArgs): Intent<IntentDataSignMessage> {
  return makeIntent(IntentName.signMessage, lifespan, {
    wallet,
    network: chainId.toString(),
    message: message.startsWith('0x') ? message : ethers.hexlify(ethers.toUtf8Bytes(message))
  })
}

import { ethers } from 'ethers'
import { IntentDataSignMessage, IntentDataSignTypedData, IntentName } from '../clients/intent.gen'
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

export type SignTypedDataArgs = {
  typedData: any
}

export function signTypedData({
  wallet,
  chainId,
  typedData,
  lifespan
}: SignTypedDataArgs & BaseArgs): Intent<IntentDataSignTypedData> {
  return makeIntent(IntentName.signTypedData, lifespan, {
    wallet,
    network: chainId.toString(),
    typedData
  })
}

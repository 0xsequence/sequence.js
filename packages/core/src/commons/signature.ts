
import { ethers } from 'ethers'
import * as config from './config'

export type SignaturePart = {
  signature: string,
  isDynamic: boolean
}

export type Signature<T extends config.Config> = {
  version: number,
  config: T,
  subdigest: string,
  payload?: SignedPayload
}

export type UnrecoveredSignature = {
  version: number
}

export type SignedPayload = {
  message?: ethers.BytesLike,
  digest: string,
  chainid: ethers.BigNumberish,
  address: string
}

export interface SignatureCoder<
  Y extends config.Config = config.Config,
  T extends Signature<Y> = Signature<Y>,
  Z extends UnrecoveredSignature = UnrecoveredSignature
> {
  decode: (data: string) => Z,
  encode: (data: T | Z | ethers.BytesLike) => string,

  recover: (
    data: Z,
    payload: SignedPayload,
    provider: ethers.providers.Provider
  ) => Promise<T>

  supportsNoChainId: boolean

  encodeSigners: (
    config: Y,
    signatures: Map<string, SignaturePart>,
    subdigests: string[],
    chainId: ethers.BigNumberish
  ) => {
    encoded: string,
    weight: ethers.BigNumber
  }

  hasEnoughSigningPower: (
    config: Y,
    signatures: Map<string, SignaturePart>
  ) => boolean

  chainSignatures: (
    main: T | Z | ethers.BytesLike,
    sufixes: (T | Z | ethers.BytesLike)[]
  ) => string

  hashSetImageHash: (
    imageHash: string
  ) => string

  signaturesOf: (
    config: Y,
  ) => { address: string, signature: string }[]
}

export function subdigestOf(payload: SignedPayload) {
  return ethers.utils.solidityKeccak256(
    ['bytes', 'uint256', 'address', 'bytes32'],
    ['0x1901', payload.chainid, payload.address, payload.digest]
  )
}

export function isSignedPayload(payload: any): payload is SignedPayload {
  return payload.digest !== undefined && payload.chainid !== undefined && payload.address !== undefined
}

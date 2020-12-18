import { Signer as AbstractSigner } from 'ethers'

export abstract class Signer extends AbstractSigner {
  // TODO .....
}

export type SignerThreshold = {
  chaind: number,
  weight: number
}

export type SignerInfo = {
  address: string,
  networks: SignerThreshold[]
}

export interface DecodedSignature {
  threshold: number
  signers: (DecodedSigner | DecodedOwner)[]
}

export interface DecodedOwner {
  weight: number
  address: string
}

export interface DecodedSigner {
  r: string
  s: string
  v: number
  t: number
  weight: number
}

export class InvalidSigner extends Error {}

export class NotEnoughSigners extends Error {}

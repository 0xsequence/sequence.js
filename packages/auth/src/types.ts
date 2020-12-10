export interface SequenceDecodedSignature {
  threshold: number
  signers: (SequenceDecodedSigner | SequenceDecodedOwner)[]
}

export interface SequenceDecodedOwner {
  weight: number
  address: string
}

export interface SequenceDecodedSigner {
  r: string
  s: string
  v: number
  t: number
  weight: number
}

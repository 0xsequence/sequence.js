import { Config, Payload, Signature } from '@0xsequence/sequence-primitives'
import { Address, Bytes } from 'ox'

export type Envelope<T extends Payload.Payload> = {
  wallet: Address.Address
  chainId: bigint
  configuration: Config.Config
  payload: T
}

export type Signature = {
  address: Address.Address
  signature: Signature.SignatureOfSignerLeaf
}

// Address not included as it is included in the signature
export type SapientSignature = {
  imageHash: Bytes.Bytes
  signature: Signature.SignatureOfSapientSignerLeaf
}

export function isSignature(sig: any): sig is Signature {
  return typeof sig === 'object' && 'address' in sig && 'signature' in sig && !('imageHash' in sig)
}

export function isSapientSignature(sig: any): sig is SapientSignature {
  return typeof sig === 'object' && 'signature' in sig && 'imageHash' in sig
}

export type Signed<T extends Payload.Payload> = Envelope<T> & {
  signatures: (Signature | SapientSignature)[]
}

export function signatureForLeaf(envelope: Signed<Payload.Payload>, leaf: Config.Leaf) {
  if (Config.isSignerLeaf(leaf)) {
    return envelope.signatures.find((sig) => isSignature(sig) && sig.address === leaf.address)
  }

  if (Config.isSapientSignerLeaf(leaf)) {
    return envelope.signatures.find(
      (sig) => isSapientSignature(sig) && sig.imageHash === leaf.imageHash && sig.signature.address === leaf.address,
    )
  }

  return undefined
}

export function weightOf(envelope: Signed<Payload.Payload>): { weight: bigint; threshold: bigint } {
  const { maxWeight } = Config.getWeight(envelope.configuration, (s) => !!signatureForLeaf(envelope, s))

  return {
    weight: maxWeight,
    threshold: envelope.configuration.threshold,
  }
}

export function encodeSignature(envelope: Signed<Payload.Payload>): Signature.RawSignature {
  const topology = Signature.fillLeaves(
    envelope.configuration.topology,
    (s) => signatureForLeaf(envelope, s)?.signature,
  )
  return {
    noChainId: envelope.chainId === 0n,
    configuration: { ...envelope.configuration, topology },
  }
}

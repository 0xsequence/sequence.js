import { Config, Payload, Signature } from '@0xsequence/sequence-primitives'
import { Address, Bytes } from 'ox'

export type Envelope<T extends Payload.Payload> = {
  wallet: Address.Address
  chainId: bigint
  configuration: Config.Config
  payload: T
}

export type EnvelopeSignature = {
  address: Address.Address
  signature: Signature.SignatureOfSignerLeaf
}

// Address not included as it is included in the signature
export type EnvelopeSapientSignature = {
  imageHash: Bytes.Bytes
  signature: Signature.SignatureOfSapientSignerLeaf
}

export function isEnvelopeSignature(sig: any): sig is EnvelopeSignature {
  return typeof sig === 'object' && 'address' in sig && 'signature' in sig && !('imageHash' in sig)
}

export function isEnvelopeSapientSignature(sig: any): sig is EnvelopeSapientSignature {
  return typeof sig === 'object' && 'signature' in sig && 'imageHash' in sig
}

export type SignedEnvelope<T extends Payload.Payload> = Envelope<T> & {
  signatures: (EnvelopeSignature | EnvelopeSapientSignature)[]
}

export function envelopeSignatureForLeaf(envelope: SignedEnvelope<Payload.Payload>, leaf: Config.Leaf) {
  if (Config.isSignerLeaf(leaf)) {
    return envelope.signatures.find((sig) => isEnvelopeSignature(sig) && sig.address === leaf.address)
  }

  if (Config.isSapientSignerLeaf(leaf)) {
    return envelope.signatures.find(
      (sig) =>
        isEnvelopeSapientSignature(sig) && sig.imageHash === leaf.imageHash && sig.signature.address === leaf.address,
    )
  }

  return undefined
}

export function weightOf(envelope: SignedEnvelope<Payload.Payload>): { weight: bigint; threshold: bigint } {
  const { maxWeight } = Config.getWeight(envelope.configuration, (s) => !!envelopeSignatureForLeaf(envelope, s))

  return {
    weight: maxWeight,
    threshold: envelope.configuration.threshold,
  }
}

export function encodeSignature(envelope: SignedEnvelope<Payload.Payload>): Signature.RawSignature {
  const topology = Signature.fillLeaves(
    envelope.configuration.topology,
    (s) => envelopeSignatureForLeaf(envelope, s)?.signature,
  )
  return {
    noChainId: envelope.chainId === 0n,
    configuration: { ...envelope.configuration, topology },
  }
}

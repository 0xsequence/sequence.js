import { Config, Payload, Signature } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

export type Envelope<T extends Payload.Payload> = {
  readonly wallet: Address.Address
  readonly chainId: bigint
  readonly configuration: Config.Config
  readonly payload: T
}

export type Signature = {
  address: Address.Address
  signature: Signature.SignatureOfSignerLeaf
}

// Address not included as it is included in the signature
export type SapientSignature = {
  imageHash: Hex.Hex
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
  const { weight } = Config.getWeight(envelope.configuration, (s) => !!signatureForLeaf(envelope, s))

  return {
    weight: weight,
    threshold: envelope.configuration.threshold,
  }
}

export function reachedThreshold(envelope: Signed<Payload.Payload>): boolean {
  const { weight, threshold } = weightOf(envelope)
  return weight >= threshold
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

export function toSigned<T extends Payload.Payload>(
  envelope: Envelope<T>,
  signatures: (Signature | SapientSignature)[] = [],
): Signed<T> {
  return {
    ...envelope,
    signatures,
  }
}

export function addSignature(
  envelope: Signed<Payload.Payload>,
  signature: Signature | SapientSignature,
  args?: { replace?: boolean },
) {
  if (isSapientSignature(signature)) {
    // Find if the signature already exists in envelope
    const prev = envelope.signatures.find(
      (sig) =>
        isSapientSignature(sig) &&
        sig.signature.address === signature.signature.address &&
        sig.imageHash === signature.imageHash,
    ) as SapientSignature | undefined

    if (prev) {
      // If the signatures are identical, then we can do nothing
      if (prev.signature.data === signature.signature.data) {
        return
      }

      // If not and we are replacing, then remove the previous signature
      if (args?.replace) {
        envelope.signatures = envelope.signatures.filter((sig) => sig !== prev)
      } else {
        throw new Error('Signature already defined for signer')
      }
    }

    envelope.signatures.push(signature)
  } else if (isSignature(signature)) {
    // Find if the signature already exists in envelope
    const prev = envelope.signatures.find((sig) => isSignature(sig) && sig.address === signature.address) as
      | Signature
      | undefined

    if (prev) {
      // If the signatures are identical, then we can do nothing
      if (prev.signature.type === 'erc1271' && signature.signature.type === 'erc1271') {
        if (prev.signature.data === signature.signature.data) {
          return
        }
      } else if (prev.signature.type !== 'erc1271' && signature.signature.type !== 'erc1271') {
        if (prev.signature.r === signature.signature.r && prev.signature.s === signature.signature.s) {
          return
        }
      }

      // If not and we are replacing, then remove the previous signature
      if (args?.replace) {
        envelope.signatures = envelope.signatures.filter((sig) => sig !== prev)
      } else {
        throw new Error('Signature already defined for signer')
      }
    }

    envelope.signatures.push(signature)
  } else {
    throw new Error('Unsupported signature type')
  }
}

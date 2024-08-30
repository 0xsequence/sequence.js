import { ethers } from 'ethers'
import * as base from '../commons/signature'
import { AddressMember, WalletConfig } from './config'
import { isValidSignature, recoverSigner } from '../commons/signer'

export enum SignaturePartType {
  EOASignature = 0,
  Address = 1,
  DynamicSignature = 2
}

export type Signature = base.Signature<WalletConfig>

export type UnrecoveredSignatureMember = {
  unrecovered: true
  weight: ethers.BigNumberish
  signature: string
  address?: string
  isDynamic: boolean
}

export type UnrecoveredMember = AddressMember | UnrecoveredSignatureMember

export type UnrecoveredSignature = base.UnrecoveredSignature & {
  threshold: ethers.BigNumberish
  signers: UnrecoveredMember[]
}

export function isAddressMember(member: any): member is AddressMember {
  return (member as AddressMember).address !== undefined && !isUnrecoveredSignatureMember(member)
}

export function isUnrecoveredSignatureMember(member: any): member is UnrecoveredSignatureMember {
  return (
    (member as UnrecoveredSignatureMember).signature !== undefined &&
    (member as UnrecoveredSignatureMember).weight !== undefined &&
    (member as UnrecoveredSignatureMember).isDynamic !== undefined
  )
}

export function isUnrecoveredSignature(signature: Signature | UnrecoveredSignature): signature is UnrecoveredSignature {
  return (signature as UnrecoveredSignature).threshold !== undefined && (signature as UnrecoveredSignature).signers !== undefined
}

export function decodeSignature(signature: ethers.BytesLike): UnrecoveredSignature {
  const bytes = ethers.getBytes(signature)

  const threshold = (bytes[0] << 8) | bytes[1]
  const signers: UnrecoveredMember[] = []

  for (let i = 2; i < bytes.length; ) {
    const type = bytes[i++]
    const weight = bytes[i++]

    switch (type) {
      case SignaturePartType.EOASignature:
        signers.push({
          unrecovered: true,
          weight,
          signature: ethers.hexlify(bytes.slice(i, i + 66)),
          isDynamic: false
        })
        i += 66
        break

      case SignaturePartType.Address:
        signers.push({
          weight,
          address: ethers.getAddress(ethers.hexlify(bytes.slice(i, i + 20)))
        })
        i += 20
        break

      case SignaturePartType.DynamicSignature:
        const address = ethers.getAddress(ethers.hexlify(bytes.slice(i, i + 20)))
        i += 20

        const size = (bytes[i] << 8) | bytes[i + 1]
        i += 2

        signers.push({
          unrecovered: true,
          weight,
          signature: ethers.hexlify(bytes.slice(i, i + size)),
          address,
          isDynamic: true
        })
        i += size
        break

      default:
        throw new Error(`Unknown signature part type: ${type}`)
    }
  }

  return { version: 1, threshold, signers }
}

export function encodeSignature(signature: Signature | UnrecoveredSignature | ethers.BytesLike): string {
  if (ethers.isBytesLike(signature)) {
    return ethers.hexlify(signature)
  }

  const { signers, threshold } = isUnrecoveredSignature(signature) ? signature : signature.config

  const encodedSigners = signers.map(s => {
    if (isAddressMember(s)) {
      return ethers.solidityPacked(['uint8', 'uint8', 'address'], [SignaturePartType.Address, s.weight, s.address])
    }

    if (s.isDynamic) {
      const bytes = ethers.getBytes(s.signature)
      return ethers.solidityPacked(
        ['uint8', 'uint8', 'address', 'uint16', 'bytes'],
        [SignaturePartType.DynamicSignature, s.weight, s.address, bytes.length, bytes]
      )
    }

    return ethers.solidityPacked(['uint8', 'uint8', 'bytes'], [SignaturePartType.EOASignature, s.weight, s.signature])
  })

  return ethers.solidityPacked(['uint16', ...new Array(encodedSigners.length).fill('bytes')], [threshold, ...encodedSigners])
}

export async function recoverSignature(
  data: UnrecoveredSignature,
  payload: base.SignedPayload,
  provider: ethers.Provider
): Promise<Signature> {
  const subdigest = base.subdigestOf(payload)
  const signers = await Promise.all(
    data.signers.map(async s => {
      if (isAddressMember(s)) {
        return s
      }

      if (s.isDynamic) {
        if (!s.address) throw new Error('Dynamic signature part must have address')
        if (!isValidSignature(s.address, subdigest, s.signature, provider)) {
          throw new Error(`Invalid dynamic signature part ${s.address}`)
        }

        return { address: s.address, weight: s.weight, signature: s.signature }
      } else {
        const address = recoverSigner(subdigest, s.signature)
        return { address, weight: s.weight, signature: s.signature }
      }
    })
  )

  return {
    version: 1,
    payload,
    subdigest,
    config: {
      version: 1,
      threshold: data.threshold,
      signers
    }
  }
}

export function encodeSigners(
  config: WalletConfig,
  signatures: Map<string, base.SignaturePart>,
  subdigests: string[],
  _: ethers.BigNumberish
): { encoded: string; weight: bigint } {
  if (subdigests.length !== 0) {
    throw new Error('Explicit subdigests not supported on v1')
  }

  let weight = 0n
  const parts = config.signers.map(s => {
    if (!signatures.has(s.address)) {
      return s
    }

    const signature = signatures.get(s.address)!
    const bytes = ethers.getBytes(signature.signature)

    weight += BigInt(s.weight)

    if (signature.isDynamic || bytes.length !== 66) {
      return {
        ...s,
        isDynamic: true,
        signature: signature.signature,
        address: s.address
      }
    }

    return {
      ...s,
      isDynamic: false,
      signature: signature.signature
    }
  })

  const encoded = encodeSignature({ version: 1, threshold: config.threshold, signers: parts })
  return { encoded, weight }
}

export const SignatureCoder: base.SignatureCoder<WalletConfig, Signature, UnrecoveredSignature> = {
  decode: (data: string): UnrecoveredSignature => {
    return decodeSignature(data)
  },

  encode: (data: Signature | UnrecoveredSignature | ethers.BytesLike): string => {
    return encodeSignature(data)
  },

  trim: async (data: string): Promise<string> => {
    return data
  },

  supportsNoChainId: true,

  recover: (data: UnrecoveredSignature, payload: base.SignedPayload, provider: ethers.Provider): Promise<Signature> => {
    return recoverSignature(data, payload, provider)
  },

  encodeSigners: (
    config: WalletConfig,
    signatures: Map<string, base.SignaturePart>,
    subdigests: string[],
    chainId: ethers.BigNumberish
  ): {
    encoded: string
    weight: bigint
  } => {
    return encodeSigners(config, signatures, subdigests, chainId)
  },

  hasEnoughSigningPower: (config: WalletConfig, signatures: Map<string, base.SignaturePart>): boolean => {
    const { weight } = SignatureCoder.encodeSigners(config, signatures, [], 0)
    return weight >= BigInt(config.threshold)
  },

  chainSignatures: (
    _main: Signature | UnrecoveredSignature | ethers.BytesLike,
    _suffix: (Signature | UnrecoveredSignature | ethers.BytesLike)[]
  ): string => {
    throw new Error('Signature chaining not supported on v1')
  },

  hashSetImageHash: function (_imageHash: string): string {
    throw new Error('Image hash not supported on v1')
  },

  signaturesOf(config: WalletConfig): { address: string; signature: string }[] {
    return config.signers.filter(s => s.signature !== undefined).map(s => ({ address: s.address, signature: s.signature! }))
  },

  signaturesOfDecoded: function (data: UnrecoveredSignature): string[] {
    return data.signers.map(s => s.signature).filter(s => s !== undefined) as string[]
  }
}

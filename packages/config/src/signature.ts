import { BytesLike, ethers } from "ethers"

export type DecodedSignature = {
  threshold: number
  signers: DecodedSignaturePart[]
}

export type DecodedSignaturePart = DecodedAddressPart | DecodedEOASigner | DecodedEOASplitSigner | DecodedFullSigner

export type DecodedAddressPart = {
  weight: number
  address: string
}

export type DecodedEOASigner = {
  weight: number
  signature: ethers.BytesLike
}

export type DecodedEOASplitSigner = {
  weight: number
  r: string
  s: string
  v: number
  t: number
}

export type DecodedFullSigner = {
  weight: number
  address: string
  signature: ethers.BytesLike
}

export function isDecodedAddress(cand: DecodedSignaturePart): cand is DecodedAddressPart {
  const c = cand as any; return c.address !== undefined && c.signature === undefined
}

export function isDecodedEOASigner(cand: DecodedSignaturePart): cand is DecodedEOASigner {
  const c = cand as any

  return (
    c.signature !== undefined &&
    c.address === undefined
  )
}

export function isDecodedEOASplitSigner(cand: DecodedSignaturePart): cand is DecodedEOASplitSigner {
  const c = cand as any

  return (
    c.r !== undefined &&
    c.s !== undefined &&
    c.v !== undefined &&
    c.t !== undefined
  )
}

export function isDecodedFullSigner(cand: DecodedSignaturePart): cand is DecodedFullSigner {
  const c = cand as any

  return (
    c.address !== undefined &&
    c.signature !== undefined
  )
}

export enum SignatureType {
  EOA = 0,
  Address = 1,
  Full = 2
}


export const decodeSignature = (signature: string): DecodedSignature => {
  const auxsig = signature.replace('0x', '')

  const threshold = ethers.BigNumber.from(`0x${auxsig.slice(0, 4)}`).toNumber()

  const signers: DecodedSignaturePart[] = []

  for (let rindex = 4; rindex < auxsig.length; ) {
    const signatureType = ethers.BigNumber.from(auxsig.slice(rindex, rindex + 2)).toNumber() as SignatureType
    rindex += 2

    const weight = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
    rindex += 2

    switch (signatureType) {
      case SignatureType.Address:
        const addr = ethers.utils.getAddress(auxsig.slice(rindex, rindex + 40))
        rindex += 40
  
        signers.push({
          weight: weight,
          address: addr
        })
        break;
    
      case SignatureType.EOA:
        const sig = ethers.utils.arrayify(`0x${auxsig.slice(rindex, rindex + 132)}`)
        rindex += 132

        const split = ethers.utils.splitSignature(sig.slice(0, 65))
        const r = split.r
        const s = split.s
        const v = split.v
  
        const t = ethers.BigNumber.from(sig[sig.length - 1]).toNumber()
  
        signers.push({
          weight: weight,
          signature: sig,
          r: r,
          s: s,
          v: v,
          t: t
        })

        break

      case SignatureType.Full:
        const address = ethers.utils.getAddress(auxsig.slice(rindex, rindex + 40))
        rindex += 40

        const size = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 4)}`).mul(2).toNumber()
        rindex += 4

        const signature = ethers.utils.arrayify(`0x${auxsig.slice(rindex, rindex + size)}`)
        rindex += size

        signers.push({
          weight: weight,
          address: address,
          signature: signature
        })
        break

      default:
        throw Error('Signature type not supported')
    }
  }

  return {
    threshold: threshold,
    signers: signers
  }
}

const SIG_TYPE_EIP712 = 1
const SIG_TYPE_ETH_SIGN = 2

export const splitDecodedEOASigner = (sig: DecodedEOASigner): DecodedEOASplitSigner => {
  const signature = ethers.utils.arrayify(sig.signature)
  const split = ethers.utils.splitSignature(signature.slice(0, 65))
  const t = ethers.BigNumber.from(signature[signature.length - 1]).toNumber()

  return {
    ...sig,
    ...split,
    t: t
  }
}

export const recoverEOASigner = (digest: BytesLike, sig: DecodedEOASigner | DecodedEOASplitSigner) => {
  const signature = isDecodedEOASplitSigner(sig) ? sig : splitDecodedEOASigner(sig)

  switch (signature.t) {
    case SIG_TYPE_EIP712:
      return ethers.utils.recoverAddress(digest, {
        r: signature.r,
        s: signature.s,
        v: signature.v
      })
    case SIG_TYPE_ETH_SIGN:
      const subDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['string', 'bytes32'],
          ['\x19Ethereum Signed Message:\n32', digest]
        )
      )

      return ethers.utils.recoverAddress(subDigest, {
        r: signature.r,
        s: signature.s,
        v: signature.v
      })
    default:
      throw new Error('Unknown signature')
  }
}

export const joinSignatures = (...signatures: Array<DecodedSignature | string>): DecodedSignature => {
  const parts = signatures.map((s) => typeof s === 'string' ? decodeSignature(s) : s)
  return parts.reduce((p, c) => joinTwoSignatures(p, c))
}

export const joinTwoSignatures = (a: DecodedSignature, b: DecodedSignature): DecodedSignature => {
  return { threshold: a.threshold, signers: a.signers.map((s, i) => isDecodedAddress(s) ? b.signers[i] : s) }
}

export const encodeSignature = (sig: DecodedSignature): string => {
  const accountBytes = sig.signers.map(s => {
    if (isDecodedAddress(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'address'],
        [SignatureType.Address, s.weight, s.address]
      )
    }

    if (isDecodedEOASplitSigner(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [SignatureType.EOA, s.weight, s.r, s.s, s.v, s.t]
      )
    }

    if (isDecodedFullSigner(s)) {
      const signatureSize = ethers.utils.arrayify(s.signature).length
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'address', 'uint16', 'bytes'],
        [SignatureType.Full, s.weight, s.address, signatureSize, s.signature]
      )
    }

    if (isDecodedEOASigner(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'bytes'], 
        [SignatureType.EOA, s.weight, s.signature]
      )
    }

    throw Error('Unkwnown signature part type')
  })

  return ethers.utils.solidityPack(['uint16', ...Array(accountBytes.length).fill('bytes')], [sig.threshold, ...accountBytes])
}

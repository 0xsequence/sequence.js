import * as multicall from '@0xsequence/multicall'
import { BytesLike, ethers } from 'ethers'
import { WalletConfig } from "."

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
  const c = cand as any; return c.address !== undefined && !isDecodedSigner(cand)
}

export function isDecodedSigner(cand: DecodedSignaturePart): cand is DecodedEOASigner | DecodedEOASplitSigner | DecodedFullSigner {
  return isDecodedEOASigner(cand) || isDecodedEOASplitSigner(cand) || isDecodedFullSigner(cand)
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


export const decodeSignature = (signature: string | DecodedSignature): DecodedSignature => {
  if (typeof signature !== 'string') return signature

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
const SIG_TYPE_WALLET_BYTES32 = 3

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

export const encodeSignature = (sig: DecodedSignature | string): string => {
  if (typeof sig === 'string') return encodeSignature(decodeSignature(sig))

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

export function signerOf(part: DecodedSignaturePart, digest: BytesLike): string {
  if (isDecodedAddress(part)) {
    return part.address
  }

  if (isDecodedFullSigner(part)) {
    return part.address
  }

  if (isDecodedEOASplitSigner(part) || isDecodedEOASigner(part)) {
    return recoverEOASigner(digest, part)
  }

  throw Error('Unkwnown signature part type')
}

export function mutateSignature(sig: DecodedSignature, config: WalletConfig, digest: BytesLike): DecodedSignature {
  const allSigners = sig.signers.map((s) => signerOf(s, digest))

  return {
    threshold: config.threshold,
    signers: config.signers.map((s) => {
      const found = allSigners.indexOf(s.address)
      if (found !== -1) {
        const part = sig.signers[found]
        return { ...part, weight: s.weight }
      }

      return {
        weight: s.weight,
        address: s.address
      }
    })
  }
}

export async function buildStubSignature(
  provider: ethers.providers.Provider,
  config: WalletConfig
): Promise<DecodedSignature> {
  const multicallProvider = new multicall.providers.MulticallProvider(provider)

  // Pre-load if signers are EOAs or not
  const signers = await Promise.all(
    config.signers.map(async (s, i) => {
      return {
        ...s,
        index: i,
        isEOA: ethers.utils.arrayify((await multicallProvider.getCode(s.address))).length === 0
      }
    })
  )

  // Sort signers by weight
  // and prepare them for selection
  let sortedSigners: {
    weight: number,
    index: number,
    address: string,
    isEOA: boolean,
    willSign?: boolean
  }[] = signers.sort((a, b) => a.weight - b.weight)

  // Keep track of the total signing power
  let totalWeight = 0

  // First pick non-eoa signers
  sortedSigners = sortedSigners.map((s) => {
    if (totalWeight >= config.threshold || s.isEOA) return s

    totalWeight += s.weight
    return { ...s, willSign: true }
  })

  // If we still haven't reached threshold
  // start picking non-EOA signers
  if (totalWeight < config.threshold) {
    sortedSigners = sortedSigners.map((s) => {
      if (s.willSign || totalWeight >= config.threshold) return s

      totalWeight += s.weight
      return { ...s, willSign: true }
    })
  }

  // Stub signature part
  // pre-determined signature, tailored for worse-case scenario in gas costs
  const stubSig = ethers.utils.arrayify("0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a01b02")

  // Re-sort signers by original index
  const finalSigners = sortedSigners.sort((a, b) => a.index - b.index)

  // Map final signers to signature parts
  return {
    threshold: config.threshold,
    signers: finalSigners.map((s) => {
      // If wallet shouldn't sign
      // just return address part
      if (!s.willSign) {
        return {
          address: s.address,
          weight: s.weight,
        } as DecodedAddressPart
      }

      // If wallet is EOA return signature
      // part is with stubSign
      if (s.isEOA) {
        return {
          weight: s.weight,
          signature: stubSig,
        } as DecodedEOASigner
      }

      // If wallet is a contract
      // build a stub nested signature
      return {
        weight: s.weight,
        address: s.address,
        signature: encodeSignature({
          threshold: 1,
          signers: [
            {
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            },
            {
              weight: 1,
              signature: stubSig
            }
          ]
        }) + ethers.utils.hexlify(SIG_TYPE_WALLET_BYTES32).substring(2)
      }
    })
  }
}

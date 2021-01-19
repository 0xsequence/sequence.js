import { BytesLike, ethers, Contract } from 'ethers'
import { Signer, DecodedSignature, DecodedEOASigner, isSequenceSigner, SignatureType, isDecodedEOASigner, isDecodedFullSigner, isDecodedAddress, DecodedAddressPart, DecodedFullSigner } from './signer'
import { walletContracts } from '@0xsequence/abi'
import { WalletConfig } from '@0xsequence/config'
import { JsonRpcProvider } from '@ethersproject/providers'
import { isValidSignature } from './validate'
import { WalletContext } from '@0xsequence/network'

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

export const fetchImageHash = async (signer: Signer): Promise<string> => {
  const address = await signer.getAddress()
  const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, await signer.getProvider())
  const currentImageHash = await (walletContract.functions.imageHash.call([]).catch(() => []))  as string[]
  return currentImageHash && currentImageHash.length > 0 ? currentImageHash[0] : ''
}

// recoverConfig decodes a WalletConfig from the subDigest and signature combo. Note: the subDigest argument
// is an encoding format of the original message, encoded by:
//
// subDigest = packMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
export const recoverConfig = async (
  subDigest:
  BytesLike,
  signature: string | DecodedSignature,
  provider?: ethers.providers.Provider,
  context?: WalletContext,
  chainId?: number,
  walletSignersValidation?: boolean
): Promise<WalletConfig> => {
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(subDigest))
  return recoverConfigFromDigest(digest, signature, provider, context, chainId, walletSignersValidation)
}

// recoverConfigFromDigest decodes a WalletConfig from a digest and signature combo. Note: the digest
// is the keccak256 of the subDigest, see `recoverConfig` method.
export const recoverConfigFromDigest = async (
  digest: BytesLike,
  signature: string | DecodedSignature,
  provider?: ethers.providers.Provider,
  context?: WalletContext,
  chainId?: number,
  walletSignersValidation?: boolean
): Promise<WalletConfig> => {
  const decoded = (<DecodedSignature>signature).threshold !== undefined ? <DecodedSignature>signature : decodeSignature(signature as string)

  const signers = await Promise.all(decoded.signers.map(async (s) => {
    if (isDecodedEOASigner(s)) {
      return {
        weight: s.weight,
        address: recoverEOASigner(digest, s)
      }
    } else if (isDecodedAddress(s)) {
      return {
        weight: s.weight,
        address: ethers.utils.getAddress((<DecodedOwner>s).address)
      }
    } else if (isDecodedFullSigner(s)) {
      if (walletSignersValidation) {
        if (!(await isValidSignature(
          s.address,
          ethers.utils.arrayify(digest),
          ethers.utils.hexlify(s.signature),
          provider,
          context,
          chainId
        ))) throw Error('Invalid signature')
      }

      return {
        weight: s.weight,
        address: s.address
      }
    } else {
      throw Error('Uknown signature type')
    }
  }))

  return {
    threshold: decoded.threshold,
    signers: signers
  }
}

export const decodeSignature = (signature: string): DecodedSignature => {
  const auxsig = signature.replace('0x', '')

  const threshold = ethers.BigNumber.from(`0x${auxsig.slice(0, 4)}`).toNumber()

  const signers: (DecodedAddressPart | DecodedEOASigner | DecodedFullSigner)[] = []

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
        const r = `0x${auxsig.slice(rindex, rindex + 64)}`
        rindex += 64
  
        const s = `0x${auxsig.slice(rindex, rindex + 64)}`
        rindex += 64
  
        const v = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
        rindex += 2
  
        const t = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
        rindex += 2
  
        signers.push({
          weight: weight,
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

export const recoverEOASigner = (digest: BytesLike, sig: DecodedEOASigner) => {
  switch (sig.t) {
    case SIG_TYPE_EIP712:
      return ethers.utils.recoverAddress(digest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    case SIG_TYPE_ETH_SIGN:
      const subDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['string', 'bytes32'],
          ['\x19Ethereum Signed Message:\n32', digest]
        )
      )

      return ethers.utils.recoverAddress(subDigest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    default:
      throw new Error('Unknown signature')
  }
}

export const joinSignatures = (...signatures: string[]) => {
  return signatures.reduce((p, c) => joinTwoSignatures(p, c))
}

export const joinTwoSignatures = (a: string, b: string): string => {
  const da = decodeSignature(a)
  const db = decodeSignature(b)

  const signers = da.signers.map((s, i) => isDecodedAddress(s) ? db.signers[i] : s)

  const accountBytes = signers.map(s => {
    if (isDecodedAddress(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'address'],
        [SignatureType.Address, s.weight, s.address]
      )
    }

    if (isDecodedEOASigner(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [SignatureType.EOA, s.weight, s.r, s.s, s.v, s.t]
      )
    }

    if (isDecodedFullSigner(s)) {
      return ethers.utils.solidityPack(
        ['uint8', 'uint8', 'address', 'uint16', 'bytes'],
        [SignatureType.Full, s.weight, s.address, s.signature.length, s.signature]
      )
    }

    throw Error('Unkwnown signature part type')
  })

  return ethers.utils.solidityPack(['uint16', ...Array(accountBytes.length).fill('bytes')], [da.threshold, ...accountBytes])
}

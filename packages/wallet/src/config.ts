import { WalletConfig, DecodedSignature, isDecodedEOASigner, isDecodedFullSigner, isDecodedAddress, decodeSignature, recoverEOASigner } from '@0xsequence/config'
import { BytesLike, ethers, Contract } from 'ethers'
import { Signer } from './signer'
import { walletContracts } from '@0xsequence/abi'
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

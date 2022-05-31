import { BytesLike, ethers } from 'ethers'
import { sequenceContext, WalletContext } from '@0xsequence/network'
import { Provider } from '@ethersproject/providers'
import { walletContracts } from '@0xsequence/abi'
import { encodeMessageDigest, encodeTypedDataDigest, subDigestOf, TypedData } from '@0xsequence/utils'
import { decodeSignature, compareAddr, ConfigTracker, WalletConfig, isDecodedSigner, isDecodedEOASigner, isDecodedFullSigner, addressOf, imageHash as imageHashOf, DecodedSignature } from '@0xsequence/config'
import { recoverConfigFromDigest } from './config'
import { fetchImageHash } from '.'

export type ValidSignatureArgs = {
  address: string,
  digest: Uint8Array,
  signature: string,
  chainId: number
  provider: Provider
  context?: WalletContext
  configTracker?: ConfigTracker
}

const defaults = {
  context: sequenceContext,
}

function _recoverConfigFromDigest(
  subDigest: string,
  args: Pick<ValidSignatureArgs, 'provider' | 'signature' | 'context' | 'chainId' | 'configTracker'>,
  decoded?: DecodedSignature
) {

  return recoverConfigFromDigest(
    subDigest,
    decoded || args.signature,
    args.provider,
    args.context || defaults.context,
    args.chainId,
    true,
    args.configTracker
  )
}

const eip191prefix = ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n')

export const messageToBytes = (message: BytesLike): Uint8Array => {
  if (ethers.utils.isBytes(message) || ethers.utils.isHexString(message)) {
    return ethers.utils.arrayify(message)
  }

  return ethers.utils.toUtf8Bytes(message)
}

export const prefixEIP191Message = (message: BytesLike): Uint8Array => {
  const messageBytes = messageToBytes(message)
  return ethers.utils.concat([eip191prefix, ethers.utils.toUtf8Bytes(String(messageBytes.length)), messageBytes])
}

export const isValidMessageSignature = async (message: BytesLike, args: Omit<ValidSignatureArgs, 'digest'>): Promise<boolean | undefined> => {
  const prefixed = prefixEIP191Message(message)
  const digest = encodeMessageDigest(prefixed)
  return isValidSignature({ ...args, digest })
}

export const isValidTypedDataSignature = (
  typedData: TypedData,
  args: Omit<ValidSignatureArgs, 'digest'>
): Promise<boolean | undefined> => {
  const encoded = encodeTypedDataDigest(typedData)
  return isValidSignature({ ...args, digest: encoded })
}

export async function isValidSignature(args: ValidSignatureArgs): Promise<boolean> {
  const {
    address,
    digest,
    signature,
    provider,
    context,
    configTracker,
  } = args

  // Check if valid EOA signature
  //
  // TODO: the EOA check here assume its being passed a digest, but its not a correct assumption
  // as often the message signing is of a string of text and not a digest.
  if (
    isValidEIP712Signature(address, digest, signature) ||
    isValidEthSignSignature(address, digest, signature)
  ) return true

  // Check if valid deployed smart wallet (via erc1271 check)
  const erc1271Check = await isValidContractWalletSignature(address, digest, signature, provider)
  if (erc1271Check) return true

  // Check if the wallet is deployed
  // and if we can fetch any counter-factual imageHash
  const imageHash = await fetchImageHash(address, provider, configTracker && { context: context || defaults.context, tracker: configTracker })

  // Now, if the wallet is not deployed and we don't have a config
  // we evaluate the counter-factual state
  if (!imageHash) {
    return isValidSequenceUndeployedWalletSignature(args)
  }

  // Then we evaluate the signature directly
  return isValidSignatureForImageHash(imageHash, args)
}

export function isValidEIP712Signature(
  address: string,
  digest: Uint8Array,
  signature: string
): boolean {
  try {
    return compareAddr(
      ethers.utils.recoverAddress(
        digest,
        ethers.utils.splitSignature(signature)
      ),
      address
    ) === 0
  } catch {
    return false
  }
}

export function isValidEthSignSignature(
  address: string,
  digest: Uint8Array,
  signature: string
): boolean {
  try {
    const subDigest = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['string', 'bytes32'],
        ['\x19Ethereum Signed Message:\n32', digest]
      )
    )
    return compareAddr(
      ethers.utils.recoverAddress(
        subDigest,
        ethers.utils.splitSignature(signature)
      ),
      address
    ) === 0
  } catch {
    return false
  }
}

// Check if valid Smart Contract Wallet signature, via ERC1271
export async function isValidContractWalletSignature(
  address: string,
  digest: Uint8Array,
  signature: string,
  provider: Provider
) {
  try {
    const code = await provider.getCode(address)
    if (code.length === 0 || code === '0x') {
      // Signature validity can't be determined
      return undefined
    }

    const wallet = new ethers.Contract(address, walletContracts.erc1271.abi, provider)
    const response = await wallet.isValidSignature(digest, signature)
    return walletContracts.erc1271.returns.isValidSignatureBytes32 === response
  } catch {
    return false
  }
}

export async function isValidSequenceUndeployedWalletSignature(args: ValidSignatureArgs) {
  try {
    const subDigest = subDigestOf(args.address, args.chainId, args.digest)
    const decoded = decodeSignature(args.signature)
    const config = await _recoverConfigFromDigest(subDigest, args, decoded)
    const weight = decoded.signers.reduce((v, s) => isDecodedEOASigner(s) || isDecodedFullSigner(s) ? v + s.weight : v, 0)
    return compareAddr(addressOf(config, args.context || defaults.context), args.address) === 0 && weight >= decoded.threshold
  } catch {
    return false
  }
}

export async function isValidSignatureForConfig(config: WalletConfig, args: ValidSignatureArgs) {
  const subDigest = subDigestOf(args.address, args.chainId, args.digest)
  const recovered = await _recoverConfigFromDigest(subDigest, args)

  // Accumulate weight of parts that provided a signatures
  const weight = config.signers.reduce((p, c) => {
    // Find signer among recovered config
    const signedIndex = recovered.signers.findIndex((s) => compareAddr(s.address, c.address))
    if (signedIndex === -1) return p

    // If recovered was just an address, ignore it
    if (!isDecodedSigner(recovered.signers[signedIndex])) return p

    return p + recovered.signers[signedIndex].weight
  }, 0)

  return weight >= config.threshold
}

export async function isValidSignatureForImageHash(imageHash: string, args: ValidSignatureArgs) {
  const subDigest = subDigestOf(args.address, args.chainId, args.digest)
  const recovered = await _recoverConfigFromDigest(subDigest, args)

  return imageHash === imageHashOf(recovered)
}

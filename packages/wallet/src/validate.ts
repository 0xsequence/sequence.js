import { ethers } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { Provider } from '@ethersproject/providers'
import { walletContracts } from '@0xsequence/abi'
import { subDigestOf } from '@0xsequence/utils'
import { decodeSignature, compareAddr, ConfigTracker, WalletConfig, isDecodedSigner, isDecodedEOASigner, isDecodedFullSigner, addressOf, imageHash as imageHashOf } from '@0xsequence/config'
import { recoverConfigFromDigest } from './config'
import { fetchImageHash } from '.'

export async function isValidSignature(
  address: string,
  digest: Uint8Array,
  signature: string,
  provider?: Provider,
  walletContext?: WalletContext,
  chainId?: number,
  configTracker?: ConfigTracker
): Promise<boolean> {
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

  // If the provider is not defined, we can't keep going
  if (!provider) return false

  // Check if the wallet is deployed
  // and if we can fetch any counter-factual imageHash
  const imageHash = await fetchImageHash(address, provider, configTracker && walletContext && { context: walletContext, tracker: configTracker })

  // If we don't have the walletContext
  // we can't validate custom sequence signatures
  if (!walletContext) return false

  // Now, if the wallet is not deployed and we don't have a config
  // we evaluate the counter-factual state
  if (!imageHash) {
    return await isValidSequenceUndeployedWalletSignature(address, digest, signature, walletContext, provider, chainId)
  }

  // If we don't have the chainid at this point
  // we can't evaluate the signature
  if (!chainId) return false

  // Then we evaluate the signature directly
  return isValidSignatureForImageHash(address, imageHash, digest, signature, chainId, provider, configTracker, walletContext)
}

export function isValidEIP712Signature(
  address: string,
  digest: Uint8Array,
  sig: string
): boolean {
  try {
    return compareAddr(
      ethers.utils.recoverAddress(
        digest,
        ethers.utils.splitSignature(sig)
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
  sig: string
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
        ethers.utils.splitSignature(sig)
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
  sig: string,
  provider?: Provider
) {
  if (!provider) return undefined
  try {
    if ((await provider.getCode(address)) === '0x') {
      // Signature validity can't be determined
      return undefined
    }

    const wallet = new ethers.Contract(address, walletContracts.erc1271.abi, provider)
    const response = await wallet.isValidSignature(digest, sig)
    return walletContracts.erc1271.returns.isValidSignatureBytes32 === response
  } catch {
    return false
  }
}

export async function isValidSequenceUndeployedWalletSignature(
  address: string,
  digest: Uint8Array,
  sig: string,
  walletContext: WalletContext,
  provider?: Provider,
  chainId?: number
) {
  try {
    const cid = chainId ? chainId : (await provider!.getNetwork()).chainId
    const signature = decodeSignature(sig)
    const subDigest = subDigestOf(address, cid, digest)
    const config = await recoverConfigFromDigest(subDigest, signature, provider, walletContext, chainId, true)
    const weight = signature.signers.reduce((v, s) => isDecodedEOASigner(s) || isDecodedFullSigner(s) ? v + s.weight : v, 0)
    return compareAddr(addressOf(config, walletContext), address) === 0 && weight >= signature.threshold
  } catch {
    return false
  }
}

export async function isValidSignatureForConfig(
  address: string,
  config: WalletConfig,
  digest: Uint8Array,
  signature: string,
  chainId: number,
  provider?: Provider,
  configTracker?: ConfigTracker,
  walletContext?: WalletContext
) {
  const decoded = decodeSignature(signature)
  const subDigest = subDigestOf(address, chainId, digest)

  // Recover full signature
  const recovered = await recoverConfigFromDigest(
    subDigest,
    decoded,
    provider,
    walletContext,
    chainId,
    true,
    configTracker
  )

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

export async function isValidSignatureForImageHash(
  address: string,
  imageHash: string,
  digest: Uint8Array,
  signature: string,
  chainId: number,
  provider?: Provider,
  configTracker?: ConfigTracker,
  walletContext?: WalletContext
) {
  const subDigest = subDigestOf(address, chainId, digest)
  const recovered = await recoverConfigFromDigest(
    subDigest,
    signature,
    provider,
    walletContext,
    chainId,
    true,
    configTracker
  )

  return imageHash === imageHashOf(recovered)
}

import { ethers } from "ethers"
import { allVersions } from ".."

export type WalletContext = {
  version: number,
  factory: string,
  mainModule: string,
  mainModuleUpgradable: string,
  guestModule: string,

  walletCreationCode: string,
}

export function addressOf(context: WalletContext, imageHash: ethers.BytesLike) {
  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [context.walletCreationCode, ethers.utils.hexZeroPad(context.mainModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', context.factory, imageHash, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

export async function isValidCounterFactual(
  wallet: string,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike,
  chainId: ethers.BigNumberish,
  provider: ethers.providers.Provider,
  contexts: { [key: number]: WalletContext }
) {
  // We don't know the version of the signature
  // so we need to try all of them
  const res = await Promise.all(allVersions.map(async (version) => {
    try {
      const decoded = version.signature.SignatureCoder.decode(ethers.utils.hexlify(signature))

      const recovered1 = await version.signature.SignatureCoder.recover(decoded as any, {
        address: wallet,
        digest: ethers.utils.hexlify(digest),
        chainId,
      }, provider)

      const imageHash = version.config.ConfigCoder.imageHashOf(recovered1.config as any)
      const counterfactualAddress = addressOf(contexts[version.version], imageHash)

      if (counterfactualAddress.toLowerCase() === wallet.toLowerCase()) {
        return true
      }

      // chainId=0 means no chainId, so the signature is valid for all chains
      // we need to check that case too
      const recovered2 = await version.signature.SignatureCoder.recover(decoded as any, {
        address: wallet,
        digest: ethers.utils.hexlify(digest),
        chainId,
      }, provider)

      const imageHash2 = version.config.ConfigCoder.imageHashOf(recovered2.config as any)
      const counterfactualAddress2 = addressOf(contexts[version.version], imageHash2)

      return counterfactualAddress2.toLowerCase() === wallet.toLowerCase()
    } catch {}

    // We most likely failed to decode the signature
    return false
  }))

  return res.some((r) => r)
}

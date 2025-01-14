import { ethers } from 'ethers'
import { allVersions } from '..'

import { DeployedWalletContext as context1 } from '../v1'
import { DeployedWalletContext as context2 } from '../v2'

export type WalletContext = {
  version: number
  factory: string
  mainModule: string
  mainModuleUpgradable: string
  guestModule: string

  walletCreationCode: string

  proxyImplementationHook?: string
}

export function addressOf(context: WalletContext, imageHash: ethers.BytesLike) {
  const codeHash = ethers.keccak256(
    ethers.solidityPacked(['bytes', 'bytes32'], [context.walletCreationCode, ethers.zeroPadValue(context.mainModule, 32)])
  )

  const hash = ethers.keccak256(
    ethers.solidityPacked(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', context.factory, imageHash, codeHash])
  )

  return ethers.getAddress(ethers.dataSlice(hash, 12))
}

export async function isValidCounterfactual(
  wallet: string,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike,
  chainId: ethers.BigNumberish,
  provider: ethers.Provider,
  contexts: { [key: number]: WalletContext }
) {
  // We don't know the version of the signature
  // so we need to try all of them
  const res = await Promise.all(
    allVersions.map(async version => {
      try {
        const decoded = version.signature.SignatureCoder.decode(ethers.hexlify(signature))

        const recovered1 = await version.signature.SignatureCoder.recover(
          decoded as any,
          {
            address: wallet,
            digest: ethers.hexlify(digest),
            chainId
          },
          provider
        )

        const imageHash = version.config.ConfigCoder.imageHashOf(recovered1.config as any)
        const counterfactualAddress = addressOf(contexts[version.version], imageHash)

        if (counterfactualAddress.toLowerCase() === wallet.toLowerCase()) {
          return true
        }

        // chainId=0 means no chainId, so the signature is valid for all chains
        // we need to check that case too
        const recovered2 = await version.signature.SignatureCoder.recover(
          decoded as any,
          {
            address: wallet,
            digest: ethers.hexlify(digest),
            chainId
          },
          provider
        )

        const imageHash2 = version.config.ConfigCoder.imageHashOf(recovered2.config as any)
        const counterfactualAddress2 = addressOf(contexts[version.version], imageHash2)

        return counterfactualAddress2.toLowerCase() === wallet.toLowerCase()
      } catch {}

      // We most likely failed to decode the signature
      return false
    })
  )

  return res.some(r => r)
}

export type VersionedContext = { [key: number]: WalletContext }

export function isValidVersionedContext(contexts: VersionedContext): boolean {
  // number of keys is the number of versions
  const versions = Object.keys(contexts).length

  // check that all versions exist and are valid
  for (let i = 1; i <= versions; i++) {
    const context = contexts[i]
    if (!context || context.version !== i) {
      return false
    }
  }

  return true
}

export function latestContext(contexts: VersionedContext): WalletContext {
  const versions = Object.keys(contexts).length
  return contexts[versions]
}

export const defaultContexts: VersionedContext = {
  1: context1,
  2: context2
}

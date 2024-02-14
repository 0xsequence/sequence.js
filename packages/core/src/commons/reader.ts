import { walletContracts } from '@0xsequence/abi'
import { ethers } from 'ethers'
import { validateEIP6492Offchain } from './validateEIP6492'

/**
 * Provides stateful information about the wallet.
 */
export interface Reader {
  isDeployed(wallet: string): Promise<boolean>
  implementation(wallet: string): Promise<string | undefined>
  imageHash(wallet: string): Promise<string | undefined>
  nonce(wallet: string, space: ethers.BigNumberish): Promise<ethers.BigNumberish>
  isValidSignature(wallet: string, digest: ethers.BytesLike, signature: ethers.BytesLike): Promise<boolean>
}

/**
 * The OnChainReader class fetches on-chain data from a wallet.
 * It is used to understand the "real" state of the wallet contract on-chain.
 */
export class OnChainReader implements Reader {
  // Simple cache to avoid re-fetching the same data
  private isDeployedCache: Set<string> = new Set()

  constructor(public readonly provider: ethers.Provider) {}

  private module(address: string) {
    return new ethers.Contract(
      address,
      [...walletContracts.mainModuleUpgradable.abi, ...walletContracts.mainModule.abi, ...walletContracts.erc1271.abi],
      this.provider
    )
  }

  async isDeployed(wallet: string): Promise<boolean> {
    // This is safe to cache because the wallet cannot be undeployed once deployed
    if (this.isDeployedCache.has(wallet)) {
      return true
    }

    const code = await this.provider.getCode(wallet).then(c => ethers.getBytes(c))
    const isDeployed = code.length !== 0
    if (isDeployed) {
      this.isDeployedCache.add(wallet)
    }

    return isDeployed
  }

  async implementation(wallet: string): Promise<string | undefined> {
    const position = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [wallet])
    const val = await this.provider.getStorage(wallet, position).then(c => ethers.getBytes(c))

    if (val.length === 20) {
      return ethers.getAddress(ethers.hexlify(val))
    }

    if (val.length === 32) {
      return ethers.AbiCoder.defaultAbiCoder().decode(['address'], val)[0]
    }

    return undefined
  }

  async imageHash(wallet: string): Promise<string | undefined> {
    try {
      const imageHash = await this.module(wallet).imageHash()
      return imageHash
    } catch {}

    return undefined
  }

  async nonce(wallet: string, space: ethers.BigNumberish = 0): Promise<ethers.BigNumberish> {
    try {
      const nonce = await this.module(wallet).readNonce(space)
      return nonce
    } catch (e) {
      if (!(await this.isDeployed(wallet))) {
        return 0
      }

      throw e
    }
  }

  // We use the EIP-6492 validator contract to check the signature
  // this means that if the wallet is not deployed, then the signature
  // must be prefixed with a transaction that deploys the wallet
  async isValidSignature(wallet: string, digest: ethers.BytesLike, signature: ethers.BytesLike): Promise<boolean> {
    return validateEIP6492Offchain(this.provider, wallet, digest, signature)
  }
}

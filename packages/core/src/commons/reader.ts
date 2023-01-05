import { walletContracts } from "@0xsequence/abi"
import { ethers } from "ethers"

/**
 * Provides stateful information about the wallet.
 */
export interface Reader {
  isDeployed(wallet: string): Promise<boolean>
  implementation(wallet: string): Promise<string | undefined>
  imageHash(wallet: string): Promise<string | undefined>
  nonce(wallet: string, space: ethers.BigNumberish): Promise<ethers.BigNumberish>
  isValidSignature(
    wallet: string,
    digest: ethers.BytesLike,
    signature: ethers.BytesLike
  ): Promise<boolean>
}

/**
 * The OnChainReader class fetches on-chain data from a wallet.
 * It is used to understand the "real" state of the wallet contract on-chain.
 */
 export class OnChainReader implements Reader {

  constructor(
    public readonly provider: ethers.providers.Provider
  ) {}

  private module(address: string) {
    return new ethers.Contract(
      address,
      [
        ...walletContracts.mainModuleUpgradable.abi,
        ...walletContracts.mainModule.abi,
        ...walletContracts.erc1271.abi
      ],
      this.provider
    )
  }

  async isDeployed(wallet: string): Promise<boolean> {
    const code = await this.provider.getCode(wallet).then((c) => ethers.utils.arrayify(c))
    return code.length !== 0
  }

  async implementation(wallet: string): Promise<string | undefined> {
    const position = ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
    const val = await this.provider.getStorageAt(wallet, position).then((c) => ethers.utils.arrayify(c))

    if (val.length === 20) {
      return ethers.utils.getAddress(ethers.utils.hexlify(val))
    }

    if (val.length === 32) {
      return ethers.utils.defaultAbiCoder.decode(['address'], val)[0]
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

  async isValidSignature(
    wallet: string,
    digest: ethers.BytesLike,
    signature: ethers.BytesLike
  ): Promise<boolean> {
    try {
      const isValid = await this.module(wallet).isValidSignature(digest, signature)
      return isValid === '0x1626ba7e' // as defined in ERC1271
    } catch (e) {
      if (!(await this.isDeployed(wallet))) {
        throw new Error('Wallet must be deployed to validate signature')
      }

      throw e
    }
  }
}

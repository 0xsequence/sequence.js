import { walletContracts } from "@0xsequence/abi"
import { ethers } from "ethers"

/**
 * Provides stateful information about the wallet.
 */
export interface Reader {
  isDeployed(): Promise<boolean>
  implementation(): Promise<string | undefined>
  imageHash(): Promise<string | undefined>
  nonce(space: ethers.BigNumberish): Promise<ethers.BigNumberish>
}

/**
 * The OnChainReader class fetches on-chain data from a wallet.
 * It is used to understand the "real" state of the wallet contract on-chain.
 */
 export class OnChainReader implements Reader {
  public readonly module: ethers.Contract

  constructor(
    public readonly address: string,
    public readonly provider: ethers.providers.Provider
  ) {
    this.module = new ethers.Contract(
      address,
      [...walletContracts.mainModuleUpgradable.abi, ...walletContracts.mainModule.abi],
      provider
    )
  }

  async isDeployed(): Promise<boolean> {
    const code = await this.provider.getCode(this.address).then((c) => ethers.utils.arrayify(c))
    return code.length !== 0
  }

  async implementation(): Promise<string | undefined> {
    const position = ethers.utils.defaultAbiCoder.encode(['address'], [this.address])
    const val = await this.provider.getStorageAt(this.address, position).then((c) => ethers.utils.arrayify(c))

    if (val.length === 20) {
      return ethers.utils.getAddress(ethers.utils.hexlify(val))
    }

    if (val.length === 32) {
      return ethers.utils.defaultAbiCoder.decode(['address'], val)[0]
    }

    return undefined
  }

  async imageHash(): Promise<string | undefined> {
    try {
      const imageHash = await this.module.imageHash()
      return imageHash
    } catch {}

    return undefined
  }

  async nonce(space: ethers.BigNumberish = 0): Promise<ethers.BigNumberish> {
    try {
      const nonce = await this.module.readNonce(space)
      return nonce
    } catch (e) {
      if (!(await this.isDeployed())) {
        return 0
      }

      throw e
    }
  }
}

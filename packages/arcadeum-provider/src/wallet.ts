import { ArcadeumWalletConfig } from "./types";
import { ethers } from 'ethers'
import { addressOf, sortConfig, ethSign } from './utils'
import { InvalidSigner } from "./errors";

export class Wallet {
  private readonly _signers: ethers.Wallet[]
  private readonly _config: ArcadeumWalletConfig

  constructor(config: ArcadeumWalletConfig, ...signers: (string | ethers.Wallet)[]) {
    this._signers = signers.map((s) => s instanceof ethers.Wallet ? s : new ethers.Wallet(s))
    this._config = sortConfig(config)

    // All signers must be part of the configuration
    if (this._signers.find((s) => config.signers.find((c) => c.address !== s.address))) {
      throw new InvalidSigner('Signer not found in configuration')
    }
  }

  get address(): string {
    return addressOf(this._config)
  }

  async signMessage(message: string): Promise<string> {
    const accountBytes = await Promise.all(
      this._config.signers.map(async (a) => {
        const signer = this._signers.find((s) => s.address === a.address)
        if (signer) {
          return ethers.utils.solidityPack(
            ['bool', 'uint8', 'bytes'],
            [false, a.weight, await ethSign(signer, message)]
          )
        } else {
          return ethers.utils.solidityPack(
            ['bool', 'uint8', 'address'],
            [true, a.weight, a.address]
          )
        }
      })
    )

    return ethers.utils.solidityPack(
      ['uint16', ...Array(this._config.signers.length).fill('bytes')],
      [this._config.threshold, ...accountBytes]
    )
  }
}

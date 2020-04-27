import { ArcadeumWalletConfig, ArcadeumContext, ArcadeumTransaction } from "./types"
import { ethers } from 'ethers'
import { addressOf, sortConfig, hashMetaTransactionsData, toArcadeumTransaction } from './utils'
import { BigNumberish, Arrayish } from "ethers/utils"
import { Signer as AbstractSigner } from "ethers"
import { TransactionRequest, TransactionResponse, BlockTag, Provider, JsonRpcProvider } from "ethers/providers"
import { Relayer } from "./relayer/relayer"
import { InvalidSigner } from "./errors"

export class Wallet extends AbstractSigner {
  private readonly _signers: AbstractSigner[]
  private readonly _config: ArcadeumWalletConfig
  private readonly _context: ArcadeumContext

  provider: Provider
  relayer: Relayer

  constructor(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...signers: (Arrayish | AbstractSigner)[]
  ) {
    super()

    this._signers = signers.map((s) => AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s))
    this._config = sortConfig(config)
    this._context = context
  }

  get address() {
    return addressOf(this._config, this._context)
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  setProvider(provider: (Provider | string)): Wallet {
    this.provider = typeof(provider) === 'string' ? new JsonRpcProvider(provider) : provider
    return this
  }

  setRelayer(relayer: Relayer): Wallet {
    this.relayer = relayer
    return this
  }

  connect(provider: (Provider | string), relayer: Relayer): Wallet {
    return new Wallet(this._config, this._context, ...this._signers)
      .setProvider(provider)
      .setRelayer(relayer)
  }

  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    if (!this.provider) { throw new Error('missing provider') }
    return 0 // TODO Lookup real nonce of contract wallet
  }

  async sendTransaction(transaction: TransactionRequest): Promise<TransactionResponse> {
    if (!this.provider) { throw new Error('missing provider') }
    if (!this.relayer) { throw new Error('missing relayer') }

    let nonce: BigNumberish
    if (transaction.nonce) {
      nonce = await transaction.nonce
    } else {
      nonce = await this.getTransactionCount(undefined)
    }

    const arctx = await toArcadeumTransaction(this, transaction)
    const signature = this.signTransactions(nonce, arctx)

    return this.relayer.relay(nonce, this._config, this._context, signature, arctx)
  }

  async signTransactions(
    nonce: BigNumberish,
    ...txs: ArcadeumTransaction[]
  ): Promise<string> {
    const hash = hashMetaTransactionsData(this.address, nonce, ...txs)
    return this.signMessage(hash)
  }

  async signMessage(message: string): Promise<string> {
    const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

    const accountBytes = await Promise.all(
      this._config.signers.map(async (a) => {
        const signer = this._signers.find(async (s) => await s.getAddress() === a.address)
        if (signer) {
          return ethers.utils.solidityPack(
            ['bool', 'uint8', 'bytes'],
            [false, a.weight, await signer.signMessage(digest) + '02']
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

  static async singleOwner(context: ArcadeumContext, owner: (Arrayish | AbstractSigner)): Promise<Wallet> {
    const signer = AbstractSigner.isSigner(owner) ? owner : new ethers.Wallet(owner)

    const config = {
      threshold: 1,
      signers: [{
        weight: 1,
        address: await signer.getAddress()
      }]
    }

    return new Wallet(config, context, owner)
  }
}

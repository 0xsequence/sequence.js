import { ArcadeumWalletConfig, ArcadeumContext, ArcadeumTransaction, Transactionish } from "./types"
import { ethers } from 'ethers'
import { addressOf, sortConfig, hashMetaTransactionsData, toArcadeumTransaction, encodeMessageData, isAsyncSendable, isArcadeumTransaction, readArcadeumNonce, appendNonce, hasArcadeumTransactions, toArcadeumTransactions } from './utils'
import { BigNumberish, Arrayish } from "ethers/utils"
import { Signer as AbstractSigner } from "ethers"
import { TransactionRequest, TransactionResponse, BlockTag, Provider, JsonRpcProvider, AsyncSendable, Web3Provider } from "ethers/providers"
import { Relayer } from "./relayer/relayer"
import { abi as mainModuleAbi } from "./abi/mainModule"
import { JsonRpcAsyncSendable } from "./providers/async-provider"
import { ConnectionInfo } from "ethers/utils/web"

export class Wallet extends AbstractSigner {
  private readonly _signers: AbstractSigner[]

  readonly context: ArcadeumContext
  readonly config: ArcadeumWalletConfig

  w3provider: AsyncSendable
  provider: Provider

  relayer: Relayer

  constructor(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...signers: (Arrayish | AbstractSigner)[]
  ) {
    super()

    this._signers = signers.map((s) => AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s))
    this.config = sortConfig(config)
    this.context = context
  }

  get address(): string {
    return addressOf(this.config, this.context)
  }

  get connected(): boolean {
    return this.w3provider !== undefined
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async chainId(): Promise<BigNumberish> {
    return (await this.provider.getNetwork()).chainId
  }

  setProvider(provider: (AsyncSendable | ConnectionInfo | string)): Wallet {
    if (isAsyncSendable(provider)) {
      this.w3provider = <AsyncSendable>provider
      this.provider = new Web3Provider(this.w3provider)
    } else {
      const jsonProvider = new JsonRpcProvider(<ConnectionInfo | string>provider)
      this.provider = jsonProvider
      this.w3provider = new JsonRpcAsyncSendable(jsonProvider)
    }
    return this
  }

  setRelayer(relayer: Relayer): Wallet {
    this.relayer = relayer
    return this
  }

  connect(provider: (AsyncSendable | ConnectionInfo | string), relayer: Relayer): Wallet {
    return new Wallet(this.config, this.context, ...this._signers)
      .setProvider(provider)
      .setRelayer(relayer)
  }

  async getNonce(blockTag?: BlockTag): Promise<number> {
    if (await this.provider.getCode(this.address) === '0x') {
      return 0
    }

    const module = new ethers.ContractFactory(mainModuleAbi, [], this).attach(this.address)

    return (await module.nonce({ blockTag: blockTag})).toNumber()
  }

  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    return this.getNonce(blockTag)
  }

  async sendTransaction(
    transaction: Transactionish
  ): Promise<TransactionResponse> {
    if (!this.provider) { throw new Error('missing provider') }
    if (!this.relayer) { throw new Error('missing relayer') }

    let arctx: ArcadeumTransaction[] = []

    if (Array.isArray(transaction)) {
      if (hasArcadeumTransactions(transaction)) {
        arctx = transaction as ArcadeumTransaction[]
      } else {
        arctx = await toArcadeumTransactions(this, transaction)
      }
    } else if (isArcadeumTransaction(transaction)) {
      arctx = [transaction as ArcadeumTransaction]
    } else {
      arctx = await toArcadeumTransactions(this, [transaction])
    }

    const providedNonce = readArcadeumNonce(...arctx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    arctx = appendNonce(arctx, nonce)

    const signature = this.signTransactions(...arctx)
    return this.relayer.relay(this.config, this.context, signature, ...arctx)
  }

  async signTransactions(
    ...txs: ArcadeumTransaction[]
  ): Promise<string> {
    const hash = hashMetaTransactionsData(
      this.address,
      await this.chainId(),
      ...txs
    )

    const digest = ethers.utils.keccak256(hash)
    return this.sign(digest)
  }

  async signMessage(message: string): Promise<string> {
    return this.sign(
      ethers.utils.keccak256(
        encodeMessageData(
          this.address,
          await this.chainId(),
          ethers.utils.hashMessage(
            ethers.utils.arrayify(message)
          )
        )
      )
    )
  }

  async sign(raw: Arrayish): Promise<string> {
    const digest = ethers.utils.arrayify(raw)
    const signersAddr = Promise.all(this._signers.map((s) => s.getAddress()))
    const accountBytes = await Promise.all(
      this.config.signers.map(async (a) => {
        const signerIndex = (await signersAddr).indexOf(a.address)
        const signer = this._signers[signerIndex]
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
      ['uint16', ...Array(this.config.signers.length).fill('bytes')],
      [this.config.threshold, ...accountBytes]
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

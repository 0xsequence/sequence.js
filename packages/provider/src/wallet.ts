import { ArcadeumWalletConfig, ArcadeumContext, ArcadeumTransaction, Transactionish, AuxTransactionRequest, NonceDependency } from './types'
import { ethers } from 'ethers'
import {
  addressOf,
  sortConfig,
  encodeMetaTransactionsData,
  packMessageData,
  isAsyncSendable,
  isArcadeumTransaction,
  readArcadeumNonce,
  appendNonce,
  hasArcadeumTransactions,
  toArcadeumTransactions,
  compareAddr,
  imageHash,
  arcadeumTxAbiEncode,
  isUsableConfig,
  makeExpirable,
  makeAfterNonce,
  aggregate
} from './utils'
import { BigNumberish, Arrayish, Interface } from 'ethers/utils'
import { Signer as AbstractSigner } from 'ethers'
import {
  TransactionResponse,
  BlockTag,
  AsyncSendable,
  Web3Provider
} from 'ethers/providers'
import { IRelayer } from './relayer'
import { abi as mainModuleAbi } from './abi/mainModule'
import { abi as mainModuleUpgradableAbi } from './abi/mainModuleUpgradable'
import { abi as requireUtilsAbi } from './abi/requireUtils'
import { JsonRpcAsyncSender } from './providers/async-sender'
import { ConnectionInfo } from 'ethers/utils/web'
import { RemoteSigner } from './signers/remote-signer'

export class Wallet extends AbstractSigner {
  private readonly _signers: AbstractSigner[]

  readonly context: ArcadeumContext
  readonly config: ArcadeumWalletConfig

  w3provider: AsyncSendable
  provider: ethers.providers.JsonRpcProvider

  relayer: IRelayer

  constructor(config: ArcadeumWalletConfig, context: ArcadeumContext, ...signers: (Arrayish | AbstractSigner)[]) {
    super()

    if (!context.nonStrict && !isUsableConfig(config)) throw new Error('non-usable configuration in strict mode')

    this._signers = signers.map(s => (AbstractSigner.isSigner(s) ? s : new ethers.Wallet(s)))
    this.config = sortConfig(config)
    this.context = context
  }

  get address(): string {
    return addressOf(this.config, this.context)
  }

  get connected(): boolean {
    return this.w3provider !== undefined
  }

  async getSigners(): Promise<string[]> {
    return Promise.all(this._signers.map((s) => s.getAddress()))
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async chainId(): Promise<BigNumberish> {
    return (await this.provider.getNetwork()).chainId
  }

  setProvider(provider: AsyncSendable | ConnectionInfo | string): Wallet {
    if (isAsyncSendable(provider)) {
      this.w3provider = <AsyncSendable>provider
      this.provider = new Web3Provider(this.w3provider)
    } else {
      const jsonProvider = new ethers.providers.JsonRpcProvider(<ConnectionInfo | string>provider)
      this.provider = jsonProvider
      this.w3provider = new JsonRpcAsyncSender(jsonProvider)
    }
    return this
  }

  setRelayer(relayer: IRelayer): Wallet {
    this.relayer = relayer
    return this
  }

  connect(provider: AsyncSendable | ConnectionInfo | string, relayer: IRelayer): Wallet {
    return new Wallet(this.config, this.context, ...this._signers).setProvider(provider).setRelayer(relayer)
  }

  async buildUpdateConfig(
    config: ArcadeumWalletConfig,
    publish = false
  ): Promise<ArcadeumTransaction[]> {
    if (!this.context.nonStrict && !isUsableConfig(config)) throw new Error('non-usable new configuration in strict mode')

    const implementation = await this.provider.getStorageAt(this.address, this.address)
    const isUpgradable = compareAddr(implementation, this.context.mainModuleUpgradable) === 0

    const walletInterface = new Interface(mainModuleAbi)

    // 131072 gas, enough for both calls
    // and a power of two to keep the gas cost of data low
    const gasLimit = ethers.constants.Two.pow(17)

    const preTransaction = isUpgradable ? [] : [{
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.address,
      value: ethers.constants.Zero,
      data: walletInterface.functions.updateImplementation.encode(
        [this.context.mainModuleUpgradable]
      )
    }]

    const transaction = {
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.address,
      value: ethers.constants.Zero,
      data: new Interface(mainModuleUpgradableAbi).functions.updateImageHash.encode(
        [imageHash(sortConfig(config))]
      )
    }

    const postTransaction = publish ? [{
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.context.requireUtils,
      value: ethers.constants.Zero,
      data: new Interface(requireUtilsAbi).functions.requireConfig.encode(
        [
          this.address,
          config.threshold,
          sortConfig(config).signers.map((s) => ({
            weight: s.weight,
            signer: s.address
          }))
        ]
      )
    }] : []

    const transactions = [...preTransaction, transaction, ...postTransaction]

    return [{
      delegateCall: false,
      revertOnError: false,
      gasLimit: gasLimit,
      to: this.address,
      value: ethers.constants.Zero,
      data: walletInterface.functions.selfExecute.encode([arcadeumTxAbiEncode(transactions)])
    }]
  }

  async updateConfig(
    config: ArcadeumWalletConfig,
    nonce?: number,
    publish = false
  ): Promise<[ArcadeumWalletConfig, TransactionResponse]> {
    const [txs, n] = await Promise.all([
      this.buildUpdateConfig(config, publish),
      nonce ? nonce : await this.getNonce()]
    )

    return [
      { address: this.address, ...config},
      await this.sendTransaction(appendNonce(txs, n))
    ]
  }

  async publishConfig(
    nonce?: number
  ): Promise<TransactionResponse> {
    return this.sendTransaction({
      delegateCall: false,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this.context.requireUtils,
      value: ethers.constants.Zero,
      nonce: nonce,
      data: new Interface(requireUtilsAbi).functions.requireConfig.encode(
        [
          this.address,
          this.config.threshold,
          sortConfig(this.config).signers.map((s) => ({
            weight: s.weight,
            signer: s.address
          }))
        ]
      )
    })
  }

  async getNonce(blockTag?: BlockTag): Promise<number> {
    return this.relayer.getNonce(this.config, this.context, 0, blockTag)
  }

  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    return this.getNonce(blockTag)
  }

  async sendTransaction(transaction: Transactionish): Promise<TransactionResponse> {
    if (!this.provider) {
      throw new Error('missing provider')
    }
    if (!this.relayer) {
      throw new Error('missing relayer')
    }

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

    // If transaction is marked as expirable
    // append expirable require
    if ((<AuxTransactionRequest>transaction).expiration) {
      arctx = makeExpirable(this.context, arctx, (<AuxTransactionRequest>transaction).expiration)
    }

    // If transaction depends on another nonce
    // append after nonce requirement
    if ((<AuxTransactionRequest>transaction).afterNonce) {
      const after = (<AuxTransactionRequest>transaction).afterNonce
      arctx = makeAfterNonce(this.context, arctx,
        (<NonceDependency>after).address ? {
          address: (<NonceDependency>after).address,
          nonce: (<NonceDependency>after).nonce,
          space: (<NonceDependency>after).space
        } : {
          address: this.address,
          nonce: <BigNumberish>after
        }
      )
    }

    // If all transactions have 0 gasLimit
    // estimate gasLimits for each transaction
    if (!arctx.find((a) => !a.revertOnError && !ethers.utils.bigNumberify(a.gasLimit).eq(ethers.constants.Zero))) {
      arctx = await this.relayer.estimateGasLimits(this.config, this.context, ...arctx)
    }

    const providedNonce = readArcadeumNonce(...arctx)
    const nonce = providedNonce ? providedNonce : await this.getNonce()
    arctx = appendNonce(arctx, nonce)
    const signature = this.signTransactions(...arctx)
    return this.relayer.relay(this.config, this.context, signature, ...arctx)
  }

  async signTransactions(...txs: ArcadeumTransaction[]): Promise<string> {
    const packed = encodeMetaTransactionsData(...txs)
    return this.sign(packed, false)
  }

  async signMessage(message: Arrayish, chainId?: number): Promise<string> {
    return this.sign(message, false, chainId)
  }

  async sign(msg: Arrayish, isDigest: boolean = true, chainId?: number): Promise<string> {
    // TODO: chainId shouldn't be required to sign digest
    const signChainId = chainId ? chainId : await this.chainId()
    const digest = ethers.utils.arrayify(isDigest ? msg :
      ethers.utils.keccak256(
        packMessageData(
          this.address,
          signChainId,
          ethers.utils.keccak256(msg)
        )
      )
    )

    // Sign digest using a set of signers and some optional data
    const signWith = async (signers: AbstractSigner[], auxData?: string) => {
      const signersAddr = Promise.all(signers.map(s => s.getAddress()))

      const accountBytes = await Promise.all(
        this.config.signers.map(async a => {
          const signerIndex = (await signersAddr).indexOf(a.address)
          const signer = signers[signerIndex]
          if (signer) {
            return ethers.utils.solidityPack(
              ['bool', 'uint8', 'bytes'],
              [false, a.weight, (await RemoteSigner.signMessageWithData(signer, digest, auxData)) + '02']
            )
          } else {
            return ethers.utils.solidityPack(['bool', 'uint8', 'address'], [true, a.weight, a.address])
          }
        })
      )
  
      return ethers.utils.solidityPack(
        ['uint16', ...Array(this.config.signers.length).fill('bytes')],
        [this.config.threshold, ...accountBytes]
      )
    }

    // Split local signers and remote signers
    const localSigners = this._signers.filter((s) => !RemoteSigner.isRemoteSigner(s))
    const remoteSigners = this._signers.filter((s) => RemoteSigner.isRemoteSigner(s))

    // Sign message first using localSigners
    // include local signatures for remote signers
    const localSignature = await signWith(localSigners, this.packMsgAndSig(msg, [], signChainId))
    const remoteSignature = await signWith(remoteSigners, this.packMsgAndSig(msg, localSignature, signChainId))

    // Aggregate both local and remote signatures
    return aggregate(localSignature, remoteSignature)
  }

  private packMsgAndSig(msg: Arrayish, sig: Arrayish, chainId: BigNumberish, ): string {
    return ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes', 'bytes'], [this.address, chainId, msg, sig])
  }

  static async singleOwner(context: ArcadeumContext, owner: Arrayish | AbstractSigner): Promise<Wallet> {
    const signer = AbstractSigner.isSigner(owner) ? owner : new ethers.Wallet(owner)

    const config = {
      threshold: 1,
      signers: [
        {
          weight: 1,
          address: await signer.getAddress()
        }
      ]
    }

    return new Wallet(config, context, owner)
  }
}

import { ethers } from 'ethers'

import { SequenceProvider, SingleNetworkSequenceProvider } from './provider'
import { SequenceClient } from './client'
import { commons } from '@0xsequence/core'
import { ChainIdLike, NetworkConfig } from '@0xsequence/network'
import { resolveArrayProperties } from './utils'
import { WalletUtils } from './utils/index'
import { OptionalChainIdLike, OptionalEIP6492 } from './types'

export interface ISequenceSigner extends Omit<ethers.Signer, 'connect'> {
  getProvider(): SequenceProvider
  getProvider(chainId: ChainIdLike): SingleNetworkSequenceProvider
  getProvider(chainId?: ChainIdLike): SequenceProvider | SingleNetworkSequenceProvider

  getSigner(): SequenceSigner
  getSigner(chainId: ChainIdLike): SingleNetworkSequenceSigner
  getSigner(chainId?: ChainIdLike): SequenceSigner | SingleNetworkSequenceSigner

  getWalletConfig(chainId?: ChainIdLike): Promise<commons.config.Config>
  getNetworks(): Promise<NetworkConfig[]>

  connect: (provider: SequenceProvider) => SequenceSigner

  signMessage(message: ethers.BytesLike, options?: OptionalChainIdLike & OptionalEIP6492): Promise<string>

  signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, Array<ethers.TypedDataField>>,
    message: Record<string, any>,
    options?: OptionalChainIdLike & OptionalEIP6492
  ): Promise<string>

  // sendTransaction takes an unsigned transaction, or list of unsigned transactions, and then has it signed by
  // the signer, and finally sends it to the relayer for submission to an Ethereum network.
  // It supports any kind of transaction, including regular ethers transactions, and Sequence transactions.
  sendTransaction(
    transaction: ethers.TransactionRequest[] | ethers.TransactionRequest,
    options?: OptionalChainIdLike
  ): Promise<commons.transaction.TransactionResponse>

  utils: WalletUtils
}

export class SequenceSigner implements ISequenceSigner {
  private readonly singleNetworkSigners: { [chainId: number]: SingleNetworkSequenceSigner } = {}

  readonly _isSequenceSigner: boolean = true

  get utils(): WalletUtils {
    return this.provider.utils
  }

  constructor(
    public client: SequenceClient,
    public provider: SequenceProvider
  ) {}

  async getAddress(): Promise<string> {
    return this.client.getAddress()
  }

  // This method shouldn't be used directly
  // it exists to maintain compatibility with ethers.Signer
  connect(provider: ethers.Provider): SequenceSigner {
    if (!SequenceProvider.is(provider)) {
      throw new Error('SequenceSigner can only be connected to a SequenceProvider')
    }

    return new SequenceSigner(this.client, provider)
  }

  getSigner(): SequenceSigner
  getSigner(chainId: ChainIdLike): SingleNetworkSequenceSigner
  getSigner(chainId?: ChainIdLike): SingleNetworkSequenceSigner | SequenceSigner

  getSigner(chainId?: ChainIdLike): SingleNetworkSequenceSigner | SequenceSigner {
    // The signer for the default network is this signer
    if (!chainId) {
      return this
    }

    const useChainId = this.provider.toChainId(chainId)

    if (!this.singleNetworkSigners[useChainId]) {
      this.singleNetworkSigners[useChainId] = new SingleNetworkSequenceSigner(this.client, this.provider, useChainId)
    }

    return this.singleNetworkSigners[useChainId]
  }

  /**
   *  Resolves the chainId to use for the given request. If no chainId is provided,
   *  it uses the chainId defined by the client (default chainId). This can be
   *  overriden to build a single-network SequenceProvider.
   */
  protected useChainId(chainId?: ChainIdLike): number {
    return this.provider.toChainId(chainId) || this.client.getChainId()
  }

  async signMessage(message: ethers.BytesLike, options?: OptionalChainIdLike & OptionalEIP6492): Promise<string> {
    const { eip6492 = true } = options || {}
    const chainId = this.useChainId(options?.chainId)
    return this.client.signMessage(message, { eip6492, chainId })
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, Array<ethers.TypedDataField>>,
    message: Record<string, any>,
    options?: OptionalChainIdLike & OptionalEIP6492
  ): Promise<string> {
    const { eip6492 = true } = options || {}
    const chainId = this.useChainId(options?.chainId)
    return this.client.signTypedData({ domain, types, message }, { eip6492, chainId })
  }

  getProvider(): SequenceProvider
  getProvider(chainId: ChainIdLike): SingleNetworkSequenceProvider
  getProvider(chainId?: ChainIdLike): SingleNetworkSequenceProvider | SequenceProvider

  getProvider(chainId?: ChainIdLike): SingleNetworkSequenceProvider | SequenceProvider {
    return this.provider.getProvider(chainId)
  }

  async sendTransaction(transaction: ethers.TransactionRequest[] | ethers.TransactionRequest, options?: OptionalChainIdLike) {
    const chainId = this.useChainId(options?.chainId)
    const resolved = await resolveArrayProperties(transaction)
    const txHash = await this.client.sendTransaction(resolved, { chainId })
    const provider = this.getProvider(chainId)

    try {
      const result = await new Promise<ethers.TransactionResponse>(resolve => {
        const check = async () => {
          const tx = await provider.getTransaction(txHash)

          if (tx !== null) {
            return resolve(tx)
          }

          await provider.once('block', check)
        }

        check()
      })

      return result
    } catch (err) {
      err.transactionHash = txHash
      throw err
    }
  }

  async getWalletConfig(chainId?: ChainIdLike | undefined): Promise<commons.config.Config> {
    const useChainId = this.useChainId(chainId)
    return this.client.getOnchainWalletConfig({ chainId: useChainId })
  }

  getNetworks(): Promise<NetworkConfig[]> {
    return this.client.getNetworks()
  }

  async getBalance(blockTag?: ethers.BlockTag | undefined, optionals?: OptionalChainIdLike): Promise<bigint> {
    const provider = this.getProvider(optionals?.chainId)
    return provider.getBalance(this.getAddress(), blockTag)
  }

  async estimateGas(transaction: ethers.TransactionRequest, optionals?: OptionalChainIdLike): Promise<bigint> {
    return this.getProvider(optionals?.chainId).estimateGas(transaction)
  }

  async call(transaction: ethers.TransactionRequest, optionals?: OptionalChainIdLike): Promise<string> {
    return this.getProvider(optionals?.chainId).call(transaction)
  }

  getChainId(): Promise<number> {
    return Promise.resolve(this.client.getChainId())
  }

  async getFeeData(optionals?: OptionalChainIdLike): Promise<ethers.FeeData> {
    return this.getProvider(optionals?.chainId).getFeeData()
  }

  async resolveName(name: string): Promise<string> {
    const res = await this.provider.resolveName(name)

    // For some reason ethers.Signer expects this to return `string`
    // but ethers.Provider expects this to return `string | null`.
    // The signer doesn't have any other source of information, so we'll
    // fail if the provider doesn't return a result.
    if (res === null) {
      throw new Error(`ENS name not found: ${name}`)
    }

    return res
  }

  _checkProvider(_operation?: string | undefined): void {
    // We always have a provider, so this is a noop
  }

  getNonce(_blockTag?: ethers.BlockTag): Promise<number> {
    throw new Error('SequenceSigner does not support getNonce')
  }

  populateCall(_transaction: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    throw new Error('SequenceSigner does not support populateCall')
  }

  populateTransaction(_transaction: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    throw new Error('SequenceSigner does not support populateTransaction')
  }

  checkTransaction(_transaction: ethers.TransactionRequest): ethers.TransactionRequest {
    throw new Error('SequenceSigner does not support checkTransaction')
  }

  getTransactionCount(_blockTag?: ethers.BlockTag): Promise<number> {
    // We could try returning the sequence nonce here
    // but we aren't sure how ethers will use this nonce
    throw new Error('SequenceSigner does not support getTransactionCount')
  }

  signTransaction(_transaction: commons.transaction.Transactionish): Promise<string> {
    // We could implement signTransaction/sendTransaction here
    // but first we need a way of serializing these signed transactions
    // and it could lead to more trouble, because the dapp could try to send this transaction
    // using a different provider, which would fail.
    throw new Error('SequenceWallet does not support signTransaction, use sendTransaction instead.')
  }

  static is(cand: any): cand is SequenceSigner {
    return cand && typeof cand === 'object' && cand._isSequenceSigner === true
  }
}

/**
 *  This is the same provider, but it only allows a single network at a time.
 *  the network defined by the constructor is the only one that can be used.
 *
 *  Attempting to call any method with a different network will throw an error.
 *  Attempting to change the network of this provider will throw an error.
 *
 *  NOTICE: These networks won't support ENS unless they are the mainnet.
 */
export class SingleNetworkSequenceSigner extends SequenceSigner {
  readonly _isSingleNetworkSequenceSigner = true

  constructor(
    client: SequenceClient,
    provider: SequenceProvider,
    public readonly chainId: ChainIdLike
  ) {
    super(client, provider.getProvider(chainId))
  }

  private _useChainId(chainId?: ChainIdLike): number {
    const provided = this.provider.toChainId(chainId)

    if (provided && provided !== this.chainId) {
      throw new Error(`This signer only supports the network ${this.chainId}, but ${provided} was requested.`)
    }

    return provided || this.provider.toChainId(this.chainId)
  }

  protected useChainId(chainId?: ChainIdLike): number {
    return this._useChainId(chainId)
  }

  getChainId(): Promise<number> {
    return Promise.resolve(this.provider.toChainId(this.chainId))
  }

  /**
   *  Override getProvider and getSigner so they always use `useChainId`
   *  this way they can't return providers and signers that can switch networks,
   *  or that don't match the chainId of this signer.
   */
  getProvider(chainId?: ChainIdLike): SingleNetworkSequenceProvider {
    return super.getProvider(this._useChainId(chainId))
  }

  getSigner(chainId?: ChainIdLike | undefined): SingleNetworkSequenceSigner {
    if (this._useChainId(chainId) !== this.chainId) {
      throw new Error(`Unreachable code`)
    }

    return this
  }

  static is(cand: any): cand is SingleNetworkSequenceSigner {
    return cand && typeof cand === 'object' && cand._isSingleNetworkSequenceSigner === true
  }
}

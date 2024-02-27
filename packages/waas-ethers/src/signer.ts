import { BigNumber, ethers } from 'ethers'
import { CommonAuthArgs, ExtendedSequenceConfig, SequenceWaaS, SequenceConfig, networks, store } from '@0xsequence/waas'

export class SequenceSigner extends ethers.Signer {
  constructor(
    private readonly sequence: SequenceWaaS,
    readonly provider?: ethers.providers.BaseProvider
  ) {
    super()
  }

  public static fromConfig(
    config: SequenceConfig & Partial<ExtendedSequenceConfig>,
    preset?: ExtendedSequenceConfig,
    store?: store.Store,
    provider?: ethers.providers.BaseProvider
  ): SequenceSigner {
    return new SequenceSigner(new SequenceWaaS(config, preset, store), provider)
  }

  async getAddress(): Promise<string> {
    return this.sequence.getAddress()
  }

  // Ensure the provider has a sequence supported network
  private async _ensureNetworkValid(providerRequired: boolean): Promise<void> {
    if (providerRequired && !this.provider) {
      throw new Error('Provider is required')
    }
    if (this.provider && networks.isSimpleNetwork((await this.provider.getNetwork()).chainId)) {
      throw new Error('Provider and WaaS configured with different networks')
    }
  }

  async getSimpleNetwork(): Promise<networks.SimpleNetwork | undefined> {
    if (this.provider) {
      return this.provider.getNetwork().then(n => n.chainId)
    }
    return undefined
  }

  async signMessage(message: ethers.utils.Bytes | string, authArgs?: CommonAuthArgs): Promise<string> {
    await this._ensureNetworkValid(false)

    const args = {
      message: message.toString(),
      network: await this.getSimpleNetwork(),
      ...authArgs
    }
    return this.sequence.signMessage(args).then(response => response.data.signature)
  }

  async signTransaction(_transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    // Not supported. Use sendTransaction or signMessage instead.
    throw new Error('SequenceSigner does not support signTransaction')
  }

  async sendTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
    authArgs?: CommonAuthArgs
  ): Promise<ethers.providers.TransactionResponse> {
    await this._ensureNetworkValid(true)

    const args = {
      transactions: [await ethers.utils.resolveProperties(transaction)],
      network: await this.getSimpleNetwork(),
      ...authArgs
    }
    const response = await this.sequence.sendTransaction(args)

    if (response.code === 'transactionFailed') {
      // Failed
      throw new Error(`Unable to send transaction: ${response.data.error}`)
    }

    if (response.code === 'transactionReceipt') {
      // Success
      const { txHash } = response.data
      // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
      return this.provider!!.getTransaction(txHash)
    }

    // Impossible
    throw new Error('Unknown return value')
  }

  connect(provider: ethers.providers.BaseProvider, sequence?: SequenceWaaS): SequenceSigner {
    return new SequenceSigner(sequence ?? this.sequence, provider)
  }

  //
  // Provider required
  //
  async getBalance(blockTag?: ethers.providers.BlockTag): Promise<BigNumber> {
    await this._ensureNetworkValid(true)
    return super.getBalance(blockTag)
  }

  async getTransactionCount(_blockTag?: ethers.providers.BlockTag): Promise<number> {
    throw new Error('SequenceSigner does not support getTransactionCount')
  }

  async estimateGas(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<BigNumber> {
    await this._ensureNetworkValid(true)
    //FIXME This won't be accurate
    return super.estimateGas(transaction)
  }

  async call(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
    blockTag?: ethers.providers.BlockTag
  ): Promise<string> {
    await this._ensureNetworkValid(true)
    return super.call(transaction, blockTag)
  }

  async getChainId(): Promise<number> {
    await this._ensureNetworkValid(true) // Prevent mismatched configurations
    return super.getChainId()
  }

  async getGasPrice(): Promise<BigNumber> {
    await this._ensureNetworkValid(true)
    return super.getGasPrice()
  }

  async getFeeData(): Promise<ethers.providers.FeeData> {
    await this._ensureNetworkValid(true)
    return super.getFeeData()
  }

  async resolveName(name: string): Promise<string> {
    await this._ensureNetworkValid(true)
    return super.resolveName(name)
  }
}

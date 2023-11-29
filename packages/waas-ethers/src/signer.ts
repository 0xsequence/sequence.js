import { ethers } from 'ethers'
import { CommonAuthArgs, Sequence, networks } from '@0xsequence/waas'

export class SequenceSigner extends ethers.Signer {
  constructor(
    private readonly sequence: Sequence,
    readonly provider?: ethers.providers.BaseProvider
  ) {
    super()
    //FIXME A way to ensure the provider and sequence are on the same network
  }

  async getAddress(): Promise<string> {
    return this.sequence.getAddress()
  }

  async getSimpleNetwork(): Promise<networks.SimpleNetwork | undefined> {
    if (this.provider) {
      return this.provider.getNetwork().then(n => n.chainId)
    }
    return undefined
  }

  async signMessage(message: ethers.utils.Bytes | string, authArgs?: CommonAuthArgs): Promise<string> {
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
    if (!this.provider || (await this.provider.getNetwork()).chainId !== networks.toNetworkID(this.sequence.getNetwork())) {
      throw new Error('Provider and WaaS configured with different networks')
    }

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
      try {
        return (await ethers.utils.poll(
          async () => {
            const tx = await this.provider!!.getTransaction(txHash)
            return tx ? this.provider!!._wrapTransaction(tx, txHash) : undefined
          },
          { onceBlock: this.provider }
        )) as ethers.providers.TransactionResponse
      } catch (err) {
        err.transactionHash = txHash
        throw err
      }
    }

    // Impossible
    throw new Error('Unknown return value')
  }

  connect(provider: ethers.providers.BaseProvider, sequence?: Sequence): SequenceSigner {
    return new SequenceSigner(sequence ?? this.sequence, provider)
  }
}

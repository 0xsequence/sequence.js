import { ChainId } from '@0xsequence/network'
import { Account } from './account'
import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { FeeOption, proto } from '@0xsequence/relayer'
import { isDeferrable } from './utils'

export type AccountSignerOptions = {
  nonceSpace?: ethers.BigNumberish
  cantValidateBehavior?: 'ignore' | 'eip6492' | 'throw'
  stubSignatureOverrides?: Map<string, string>
  selectFee?: (
    txs: ethers.utils.Deferrable<ethers.providers.TransactionRequest> | commons.transaction.Transactionish,
    options: FeeOption[]
  ) => Promise<FeeOption | undefined>
}

function encodeGasRefundTransaction(option?: FeeOption) {
  if (!option) return []

  const value = ethers.BigNumber.from(option.value)

  switch (option.token.type) {
    case proto.FeeTokenType.UNKNOWN:
      return [
        {
          delegateCall: false,
          revertOnError: true,
          gasLimit: option.gasLimit,
          to: option.to,
          value: value.toHexString(),
          data: []
        }
      ]

    case proto.FeeTokenType.ERC20_TOKEN:
      if (!option.token.contractAddress) {
        throw new Error(`No contract address for ERC-20 fee option`)
      }

      return [
        {
          delegateCall: false,
          revertOnError: true,
          gasLimit: option.gasLimit,
          to: option.token.contractAddress,
          value: 0,
          data: new ethers.utils.Interface([
            {
              constant: false,
              inputs: [{ type: 'address' }, { type: 'uint256' }],
              name: 'transfer',
              outputs: [],
              type: 'function'
            }
          ]).encodeFunctionData('transfer', [option.to, value.toHexString()])
        }
      ]

    default:
      throw new Error(`Unhandled fee token type ${option.token.type}`)
  }
}

export class AccountSigner implements ethers.Signer {
  public readonly _isSigner = true

  constructor(
    public account: Account,
    public chainId: ChainId,
    public readonly options?: AccountSignerOptions
  ) {}

  get provider() {
    return this.account.providerFor(this.chainId)
  }

  async getAddress(): Promise<string> {
    return this.account.address
  }

  signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    return this.account.signMessage(message, this.chainId, this.options?.cantValidateBehavior ?? 'throw')
  }

  private async defaultSelectFee(
    _txs: ethers.utils.Deferrable<ethers.providers.TransactionRequest> | commons.transaction.Transactionish,
    options: FeeOption[]
  ): Promise<FeeOption | undefined> {
    // If no options, return undefined
    if (options.length === 0) return undefined

    // If there are multiple options, try them one by one
    // until we find one that satisfies the balance requirement
    const balanceOfAbi = [
      {
        constant: true,
        inputs: [{ type: 'address' }],
        name: 'balanceOf',
        outputs: [{ type: 'uint256' }],
        type: 'function'
      }
    ]

    for (const option of options) {
      if (option.token.type === proto.FeeTokenType.UNKNOWN) {
        // Native token
        const balance = await this.getBalance()
        if (balance.gte(ethers.BigNumber.from(option.value))) {
          return option
        }
      } else if (option.token.contractAddress && option.token.type === proto.FeeTokenType.ERC20_TOKEN) {
        // ERC20 token
        const token = new ethers.Contract(option.token.contractAddress, balanceOfAbi, this.provider)
        const balance = await token.balanceOf(this.account.address)
        if (balance.gte(ethers.BigNumber.from(option.value))) {
          return option
        }
      } else {
        // Unsupported token type
      }
    }

    throw new Error('No fee option available - not enough balance')
  }

  async sendTransaction(
    txsPromise: ethers.utils.Deferrable<ethers.providers.TransactionRequest> | commons.transaction.Transactionish,
    options?: {
      simulateForFeeOptions?: boolean
    }
  ): Promise<ethers.providers.TransactionResponse> {
    const txs = isDeferrable(txsPromise)
      ? await ethers.utils.resolveProperties(txsPromise as ethers.utils.Deferrable<ethers.providers.TransactionRequest>)
      : txsPromise

    const prepare = await this.account.prepareTransactions({
      txs,
      chainId: this.chainId,
      stubSignatureOverrides: this.options?.stubSignatureOverrides ?? new Map(),
      simulateForFeeOptions: options?.simulateForFeeOptions
    })

    const selectMethod = this.options?.selectFee ?? this.defaultSelectFee.bind(this)
    const feeOption = await selectMethod(txs, prepare.feeOptions)

    const finalTransactions = [...prepare.transactions, ...encodeGasRefundTransaction(feeOption)]

    return this.account.sendTransaction(
      finalTransactions,
      this.chainId,
      prepare.feeQuote,
      undefined,
      undefined,
      this.options?.nonceSpace !== undefined
        ? {
            nonceSpace: this.options.nonceSpace
          }
        : undefined
    ) as Promise<ethers.providers.TransactionResponse> // Will always have a transaction response
  }

  getBalance(blockTag?: ethers.providers.BlockTag | undefined): Promise<ethers.BigNumber> {
    return this.provider.getBalance(this.account.address, blockTag)
  }

  call(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
    blockTag?: ethers.providers.BlockTag | undefined
  ): Promise<string> {
    return this.provider.call(transaction, blockTag)
  }

  async resolveName(name: string): Promise<string> {
    const res = await this.provider.resolveName(name)
    if (!res) throw new Error(`Could not resolve name ${name}`)
    return res
  }

  connect(_provider: ethers.providers.Provider): ethers.Signer {
    throw new Error('Method not implemented.')
  }

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }

  getTransactionCount(blockTag?: ethers.providers.BlockTag | undefined): Promise<number> {
    throw new Error('Method not implemented.')
  }

  estimateGas(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<ethers.BigNumber> {
    throw new Error('Method not implemented.')
  }

  getChainId(): Promise<number> {
    return Promise.resolve(ethers.BigNumber.from(this.chainId).toNumber())
  }

  getGasPrice(): Promise<ethers.BigNumber> {
    throw new Error('Method not implemented.')
  }

  getFeeData(): Promise<ethers.providers.FeeData> {
    throw new Error('Method not implemented.')
  }

  checkTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>
  ): ethers.utils.Deferrable<ethers.providers.TransactionRequest> {
    throw new Error('Method not implemented.')
  }

  populateTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>
  ): Promise<ethers.providers.TransactionRequest> {
    throw new Error('Method not implemented.')
  }

  _checkProvider(operation?: string | undefined): void {
    throw new Error('Method not implemented.')
  }
}

import { ChainId } from '@0xsequence/network'
import { Account } from './account'
import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { FeeOption, proto } from '@0xsequence/relayer'
import { toHexString } from '@0xsequence/utils'

export type AccountSignerOptions = {
  nonceSpace?: ethers.BigNumberish
  cantValidateBehavior?: 'ignore' | 'eip6492' | 'throw'
  stubSignatureOverrides?: Map<string, string>
  selectFee?: (
    txs: ethers.TransactionRequest | commons.transaction.Transactionish,
    options: FeeOption[]
  ) => Promise<FeeOption | undefined>
}

function encodeGasRefundTransaction(option?: FeeOption) {
  if (!option) return []

  const value = BigInt(option.value)

  switch (option.token.type) {
    case proto.FeeTokenType.UNKNOWN:
      return [
        {
          delegateCall: false,
          revertOnError: true,
          gasLimit: option.gasLimit,
          to: option.to,
          value: toHexString(value),
          data: '0x'
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
          data: new ethers.Interface([
            {
              constant: false,
              inputs: [{ type: 'address' }, { type: 'uint256' }],
              name: 'transfer',
              outputs: [],
              type: 'function'
            }
          ]).encodeFunctionData('transfer', [option.to, toHexString(value)])
        }
      ]

    default:
      throw new Error(`Unhandled fee token type ${option.token.type}`)
  }
}

export class AccountSigner implements ethers.AbstractSigner<ethers.Provider> {
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

  /**
   * Signs a message.
   * 
   * This method will sign the message using the account associated with this signer
   * and the specified chain ID. The message is already being prefixed with the EIP-191 prefix.
   * 
   * @param message - The message to sign. Can be a string or BytesLike.
   * @returns A Promise that resolves to the signature as a hexadecimal string
   * 
   * @example
   * ```typescript
   * const signer = account.getSigner(chainId)
   * 
   * const message = "Hello, Sequence!";
   * const signature = await signer.signMessage(message);
   * console.log(signature);
   * // => "0x123abc..." (hexadecimal signature)
   */
  signMessage(message: string | ethers.BytesLike): Promise<string> {
    return this.account.signMessage(message, this.chainId, this.options?.cantValidateBehavior ?? 'throw')
  }

  signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, Array<ethers.TypedDataField>>,
    value: Record<string, any>
  ): Promise<string> {
    return this.account.signTypedData(domain, types, value, this.chainId, this.options?.cantValidateBehavior ?? 'throw')
  }

  private async defaultSelectFee(_txs: commons.transaction.Transactionish, options: FeeOption[]): Promise<FeeOption | undefined> {
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
        if (balance >= BigInt(option.value)) {
          return option
        }
      } else if (option.token.contractAddress && option.token.type === proto.FeeTokenType.ERC20_TOKEN) {
        // ERC20 token
        const token = new ethers.Contract(option.token.contractAddress, balanceOfAbi, this.provider)
        const balance = await token.balanceOf(this.account.address)
        if (balance >= BigInt(option.value)) {
          return option
        }
      } else {
        // Unsupported token type
      }
    }

    throw new Error('No fee option available - not enough balance')
  }

  async sendTransaction(
    txs: commons.transaction.Transactionish,
    options?: {
      simulateForFeeOptions?: boolean
    }
  ): Promise<ethers.TransactionResponse> {
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
    ) as Promise<ethers.TransactionResponse> // Will always have a transaction response
  }

  getBalance(blockTag?: ethers.BlockTag | undefined): Promise<bigint> {
    return this.provider.getBalance(this.account.address, blockTag)
  }

  call(transaction: ethers.TransactionRequest, blockTag?: ethers.BlockTag): Promise<string> {
    return this.provider.call({ ...transaction, blockTag })
  }

  async resolveName(name: string): Promise<string> {
    const res = await this.provider.resolveName(name)
    if (!res) throw new Error(`Could not resolve name ${name}`)
    return res
  }

  connect(_provider: ethers.Provider): ethers.Signer {
    throw new Error('Method not implemented.')
  }

  signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    throw new Error('Method not implemented.')
  }

  getTransactionCount(blockTag?: ethers.BlockTag | undefined): Promise<number> {
    throw new Error('Method not implemented.')
  }

  estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    throw new Error('Method not implemented.')
  }

  getChainId(): Promise<number> {
    return Promise.resolve(Number(this.chainId))
  }

  getGasPrice(): Promise<bigint> {
    throw new Error('Method not implemented.')
  }

  getFeeData(): Promise<ethers.FeeData> {
    throw new Error('Method not implemented.')
  }

  getNonce(blockTag?: ethers.BlockTag): Promise<number> {
    throw new Error('Method not implemented.')
  }

  populateCall(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    throw new Error('Method not implemented.')
  }

  checkTransaction(transaction: ethers.TransactionRequest): ethers.TransactionRequest {
    throw new Error('Method not implemented.')
  }

  async populateTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    throw new Error('Method not implemented.')
  }

  _checkProvider(operation?: string | undefined): void {
    throw new Error('Method not implemented.')
  }
}

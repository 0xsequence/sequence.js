import { commons } from '@0xsequence/core'
import { logger } from '@0xsequence/utils'
import { ethers } from 'ethers'

import { FeeOption, FeeQuote, Precondition, ProviderRelayer, ProviderRelayerOptions, Relayer, proto } from '.'

export type LocalRelayerOptions = Omit<ProviderRelayerOptions, 'provider'> & {
  signer: ethers.Signer
}

export function isLocalRelayerOptions(obj: any): obj is LocalRelayerOptions {
  return typeof obj === 'object' && isAbstractSigner(obj.signer)
}

export class LocalRelayer extends ProviderRelayer implements Relayer {
  private signer: ethers.Signer
  private txnOptions: ethers.TransactionRequest

  constructor(options: LocalRelayerOptions | ethers.AbstractSigner) {
    super(isAbstractSigner(options) ? { provider: options.provider! } : { ...options, provider: options.signer.provider! })
    this.signer = isAbstractSigner(options) ? options : options.signer
    if (!this.signer.provider) throw new Error('Signer must have a provider')
  }

  async getFeeOptions(_address: string, ..._transactions: commons.transaction.Transaction[]): Promise<{ options: FeeOption[] }> {
    return { options: [] }
  }

  async getFeeOptionsRaw(
    _entrypoint: string,
    _data: ethers.BytesLike,
    _options?: {
      simulate?: boolean
    }
  ): Promise<{ options: FeeOption[] }> {
    return { options: [] }
  }

  async gasRefundOptions(address: string, ...transactions: commons.transaction.Transaction[]): Promise<FeeOption[]> {
    const { options } = await this.getFeeOptions(address, ...transactions)
    return options
  }

  setTransactionOptions(transactionRequest: ethers.TransactionRequest) {
    this.txnOptions = transactionRequest
  }

  async relay(
    transactions: commons.transaction.IntendedTransactionBundle,
    options?: { projectAccessKey?: string; quote?: FeeQuote; preconditions?: Precondition[]; waitForReceipt?: boolean }
  ): Promise<commons.transaction.TransactionResponse<ethers.TransactionReceipt>> {
    if (options?.quote) {
      logger.warn(`LocalRelayer doesn't accept fee quotes`)
    }

    const data = commons.transaction.encodeBundleExecData(transactions)

    // TODO: think about computing gas limit individually, summing together and passing across
    // NOTE: we expect that all txns have set their gasLimit ahead of time through proper estimation
    // const gasLimit = signedTxs.transactions.reduce((sum, tx) => sum + tx.gasLimit, 0n)
    // txRequest.gasLimit = gasLimit

    const responsePromise = this.signer.sendTransaction({
      to: transactions.entrypoint,
      data,
      ...this.txnOptions,
      gasLimit: 9000000
    })

    if (options?.waitForReceipt !== false) {
      const response: commons.transaction.TransactionResponse = await responsePromise
      response.receipt = await response.wait()
      return response
    } else {
      return responsePromise
    }
  }

  async getMetaTransactions(
    projectId: number,
    page?: proto.Page
  ): Promise<{
    page: proto.Page
    transactions: proto.MetaTxnLog[]
  }> {
    return { page: { page: 0, pageSize: 100 }, transactions: [] }
  }

  async getTransactionCost(
    projectId: number,
    from: string,
    to: string
  ): Promise<{
    cost: number
  }> {
    return { cost: 0 }
  }
}

function isAbstractSigner(signer: any): signer is ethers.AbstractSigner {
  return (
    signer &&
    typeof signer === 'object' &&
    typeof signer.provider === 'object' &&
    typeof signer.getAddress === 'function' &&
    typeof signer.connect === 'function'
  )
}

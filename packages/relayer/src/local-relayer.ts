import { TransactionRequest } from '@ethersproject/providers'
import { Signer as AbstractSigner } from 'ethers'
import { TransactionBundle, encodeBundleExecData, TransactionResponse } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'
import { logger } from '@0xsequence/utils'
import { FeeOption, FeeQuote, Relayer } from '.'
import { ProviderRelayer, ProviderRelayerOptions } from './provider-relayer'

export type LocalRelayerOptions = Omit<ProviderRelayerOptions, "provider"> & {
  signer: AbstractSigner
}

export function isLocalRelayerOptions(obj: any): obj is LocalRelayerOptions {
  return obj.signer !== undefined && AbstractSigner.isSigner(obj.signer)
}

export class LocalRelayer extends ProviderRelayer implements Relayer {
  private signer: AbstractSigner
  private txnOptions: TransactionRequest

  constructor(options: LocalRelayerOptions | AbstractSigner) {
    super(AbstractSigner.isSigner(options) ? { provider: options.provider! } : { ...options, provider: options.signer.provider! })
    this.signer = AbstractSigner.isSigner(options) ? options : options.signer
    if (!this.signer.provider) throw new Error("Signer must have a provider")
  }

  async getFeeOptions(
    _bundle: TransactionBundle
  ): Promise<{ options: FeeOption[] }> {
    return { options: [] }
  }

  async gasRefundOptions(
    bundle: TransactionBundle
  ): Promise<FeeOption[]> {
    const { options } = await this.getFeeOptions(bundle)
    return options
  }

  async relay(bundle: TransactionBundle, quote?: FeeQuote): Promise<TransactionResponse> {
    if (quote !== undefined) {
      logger.warn(`LocalRelayer doesn't accept fee quotes`)
    }

    const data = encodeBundleExecData(bundle)

    // TODO: think about computing gas limit individually, summing together and passing across
    // NOTE: we expect that all txns have set their gasLimit ahead of time through proper estimation
    // const gasLimit = signedTxs.transactions.reduce((sum, tx) => sum.add(tx.gasLimit), ethers.BigNumber.from(0))
    // txRequest.gasLimit = gasLimit

    return this.signer.sendTransaction({ to: bundle.entrypoint, data, ...this.txnOptions })
  }
}

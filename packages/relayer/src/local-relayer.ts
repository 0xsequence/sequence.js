import { TransactionResponse } from '@ethersproject/providers'
import { Signer as AbstractSigner, ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { Transaction, TransactionBundle, isSignedTransactionBundle, encodeBundleExecData } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'
import { FeeOption, Relayer } from '.'
import { ProviderRelayer, ProviderRelayerOptions } from './provider-relayer'

export type LocalRelayerOptions = Omit<ProviderRelayerOptions, "provider"> & {
  signer: AbstractSigner
}

export function isLocalRelayerOptions(obj: any): obj is LocalRelayerOptions {
  return obj.signer !== undefined && AbstractSigner.isSigner(obj.signer)
}

export class LocalRelayer extends ProviderRelayer implements Relayer {
  private signer: AbstractSigner

  constructor(options: LocalRelayerOptions | AbstractSigner) {
    super(AbstractSigner.isSigner(options) ? { provider: options.provider! } : { ...options, provider: options.signer.provider! })
    this.signer = AbstractSigner.isSigner(options) ? options : options.signer
    if (!this.signer.provider) throw new Error("Signer must have a provider")
  }

  async gasRefundOptions(
    _config: WalletConfig,
    _context: WalletContext,
    _bundle: TransactionBundle
  ): Promise<FeeOption[]> {
    return []
  }

  async relay(bundle: TransactionBundle): Promise<TransactionResponse> {
    const data = encodeBundleExecData(bundle)

    // TODO: think about computing gas limit individually, summing together and passing across
    // NOTE: we expect that all txns have set their gasLimit ahead of time through proper estimation
    // const gasLimit = signedTxs.transactions.reduce((sum, tx) => sum.add(tx.gasLimit), ethers.BigNumber.from(0))
    // txRequest.gasLimit = gasLimit

    return this.signer.sendTransaction({ to: bundle.entrypoint, data })
  }
}

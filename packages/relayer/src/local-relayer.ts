import { TransactionResponse } from '@ethersproject/providers'
import { Signer as AbstractSigner, ethers } from 'ethers'
import { SignedTransactions, Transaction } from '@0xsequence/transactions'
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

  async deployWallet(config: WalletConfig, context: WalletContext): Promise<TransactionResponse> {
    // NOTE: on hardhat some tests fail on HookCallerMock when not passing gasLimit directly as below,
    // and using eth_gasEstimate. Perhaps review HookCallerMock.sol and fix it to avoid what looks
    // like an infinite loop?
    const walletDeployTxn = this.prepareWalletDeploy(config, context)

    // NOTE: for hardhat to pass, we have to set the gasLimit directly, as its unable to estimate
    return this.signer.sendTransaction({ ...walletDeployTxn, gasLimit: ethers.constants.Two.pow(17) } )
  }

  async gasRefundOptions(
    _config: WalletConfig,
    _context: WalletContext,
    ..._transactions: Transaction[]
  ): Promise<FeeOption[]> {
    return []
  }

  async relay(signedTxs: SignedTransactions): Promise<TransactionResponse> {
    if (!signedTxs.context.guestModule || signedTxs.context.guestModule.length !== 42) {
      throw new Error('LocalRelayer requires the context.guestModule address')
    }

    const txRequest = await this.prepareTransactions(signedTxs.config, signedTxs.context, signedTxs.signature, ...signedTxs.transactions)

    // TODO: think about computing gas limit individually, summing together and passing across
    // NOTE: we expect that all txns have set their gasLimit ahead of time through proper estimation
    // const gasLimit = signedTxs.transactions.reduce((sum, tx) => sum.add(tx.gasLimit), ethers.BigNumber.from(0))
    // txRequest.gasLimit = gasLimit

    return this.signer.sendTransaction(txRequest)
  }
}

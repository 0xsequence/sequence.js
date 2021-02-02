import { TransactionResponse, BlockTag } from '@ethersproject/providers'
import { Signer as AbstractSigner, ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { Transaction, SignedTransactions } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { BaseRelayer } from './base-relayer'
import { Relayer } from '.'

const DEFAULT_GAS_LIMIT = ethers.BigNumber.from(800000)

export class LocalRelayer extends BaseRelayer implements Relayer {
  private readonly signer: AbstractSigner

  constructor(signer: AbstractSigner) {
    super(true, signer.provider)
    // if (!signer.provider) {
    //   throw new Error('signer.provider is not set, but is required')
    // }
    this.signer = signer
  }

  async deployWallet(config: WalletConfig, context: WalletContext): Promise<TransactionResponse> {
    // NOTE: on hardhat some tests fail on HookCallerMock when not passing gasLimit directly as below,
    // and using eth_gasEstimate. Perhaps review HookCallerMock.sol and fix it to avoid what looks
    // like an infinite loop?
    const walletDeployTxn = this.prepareWalletDeploy(config, context)

    // NOTE: for hardhat to pass, we have to set the gasLimit directly, as its unable to estimate
    return this.signer.sendTransaction({ ...walletDeployTxn, gasLimit: ethers.constants.Two.pow(17) } )
    // return this.signer.sendTransaction(walletDeployTxn)
  }

  async gasRefundOptions(
    _config: WalletConfig,
    _context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<Transaction[][]> {
    return [transactions]
  }

  async estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<Transaction[]> {
    const walletAddr = addressOf(config, context)

    const gasCosts = await Promise.all(transactions.map(async tx => {
      // Respect gasLimit request of the transaction (as long as its not 0)
      if (tx.gasLimit && !ethers.BigNumber.from(tx.gasLimit || 0).eq(ethers.constants.Zero)) {
        return tx.gasLimit
      }

      // Fee can't be estimated locally for delegateCalls
      if (tx.delegateCall) {
        return DEFAULT_GAS_LIMIT
      }

      // Fee can't be estimated for self-called if wallet hasn't been deployed
      if (tx.to === walletAddr && !(await this.isWalletDeployed(walletAddr))) {
        return DEFAULT_GAS_LIMIT
      }

      // TODO: If the wallet address has been deployed, gas limits can be
      // estimated with more accurately by using self-calls with the batch transactions one by one
      return this.signer.provider.estimateGas({
        from: walletAddr,
        to: tx.to,
        data: tx.data,
        value: tx.value
      })
    }))

    return transactions.map((t, i) => {
      t.gasLimit = gasCosts[i]
      return t
    })
  }

  async getNonce(
    config: WalletConfig,
    context: WalletContext,
    space?: number,
    blockTag?: BlockTag
  ): Promise<number> {
    const addr = addressOf(config, context)
    if ((await this.provider.getCode(addr)) === '0x') {
      return 0
    }

    const module = new ethers.Contract(addr, walletContracts.mainModule.abi, this.signer.provider)
    return (await module.nonce({ blockTag: blockTag })).toNumber()
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

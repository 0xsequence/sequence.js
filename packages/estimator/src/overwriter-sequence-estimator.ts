import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, encodeSignature } from '@0xsequence/config'
import { readSequenceNonce, Transaction } from '@0xsequence/transactions'
import { OverwriterEstimator } from './overwriter-estimator'
import { Interface } from 'ethers/lib/utils'
import { walletContracts } from '@0xsequence/abi'
import { ethers } from 'ethers'

export class OverwriterSequenceEstimator {
  constructor(public estimator: OverwriterEstimator) {}

  async estimateGasLimits(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<Transaction[]> {
    const wallet = addressOf(config, context)
    const walletInterface = new Interface(walletContracts.mainModule.abi)

    // Get non-eoa signers
    // required for computing worse case scenario
    const signers = await Promise.all(config.signers.map(async (s, i) => ({
      ...s,
      index: i,
      isEOA: ethers.utils.arrayify(await this.estimator.provider.getCode(s.address)).length === 0
    })))

    // Define designated signers
    let weightSum = 0

    const definedSigners = signers
      .sort((a, b) => !a.isEOA && b.isEOA ? -1 : 0) // Contract signers sign first
      .map((s) => {                                 // Define signers and not signers
        if (weightSum >= config.threshold) {
          return { ...s, signs: false }
        }

        weightSum += s.weight
        return { ...s, signs: true }
      })
      .sort((a, b) => a.index - b.index)            // Sort back to original configuration

    // Generate a fake signature, meant to resemble the final signature of the transaction
    // this "fake" signature is provided to compute a more accurate gas estimation
    const stubSignature = encodeSignature({ threshold: config.threshold, signers: definedSigners.map((s) => {
      if (!s.signs) return s

      if (s.isEOA) {
        return {
          weight: s.weight,
          signature: ethers.Wallet.createRandom().signMessage("") + '02'
        }
      }

      // Assume a 2/3 nested contract signature
      // TODO: Improve this, how do we get the nested signer config?
      const nestedSignature = encodeSignature({
        threshold: 2,
        signers: [{
          address: ethers.Wallet.createRandom().address,
          weight: 1
        }, {
          address: ethers.Wallet.createRandom().signMessage("") + '02',
          weight: 1
        }, {
          address: ethers.Wallet.createRandom().signMessage("") + '02',
          weight: 1
        }]
      }) + '03'

      return {
        weight: s.weight,
        signature: nestedSignature
      }
    })})

    // Use the provided nonce
    // TODO: Maybe ignore if this fails on the MainModuleGasEstimation
    // it could help reduce the edge cases for when the gas estimation fails
    const nonce = readSequenceNonce(...transactions)

    const estimates = await Promise.all([
      ...transactions.map(async (_, i) => {
        return this.estimator.estimate({
          to: wallet,
          data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [transactions.slice(0, i), nonce, stubSignature])
        })
      }), this.estimator.estimate({
        to: wallet,     // Compute full gas estimation with all transaction
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [transactions, nonce, stubSignature])
      })
    ])

    return transactions.map((t, i) => ({ ...t, gasLimit: estimates[i + 1].sub(estimates[i]) }))
  }
}

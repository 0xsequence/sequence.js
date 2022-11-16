import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, encodeSignature, DecodedFullSigner, DecodedEOASigner } from '@0xsequence/config'
import { readSequenceNonce, sequenceTxAbiEncode, Transaction } from '@0xsequence/transactions'
import { OverwriterEstimator } from './overwriter-estimator'
import { walletContracts } from '@0xsequence/abi'
import { ethers, utils } from 'ethers'
import { Estimator } from './estimator'

const MainModuleGasEstimation = require("@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModuleGasEstimation.sol/MainModuleGasEstimation.json")

export class OverwriterSequenceEstimator implements Estimator {
  constructor(public estimator: OverwriterEstimator) {}

  async estimateGasLimits(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<{ transactions:Transaction[], total: ethers.BigNumber }> {
    const wallet = addressOf(config, context)
    const walletInterface = new utils.Interface(walletContracts.mainModule.abi)

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
      // Contract signers sign first, then lowest weight signers
      .sort((a, b) => !a.isEOA && b.isEOA ? -1 : a.isEOA && !b.isEOA ? +1 : a.weight - b.weight)
      // Define signers and not signers
      .map((s) => {
        if (weightSum >= config.threshold) {
          return { ...s, signs: false }
        }

        weightSum += s.weight
        return { ...s, signs: true }
      })
      .sort((a, b) => a.index - b.index)            // Sort back to original configuration

    // Generate a fake signature, meant to resemble the final signature of the transaction
    // this "fake" signature is provided to compute a more accurate gas estimation
    const stubSignature = encodeSignature({ threshold: config.threshold, signers: await Promise.all(definedSigners.map(async (s) => {
      if (!s.signs) return s

      if (s.isEOA) {
        return {
          weight: s.weight,
          signature: (await ethers.Wallet.createRandom().signMessage("")) + '02'
        } as DecodedEOASigner
      }

      // Assume a 2/3 nested contract signature
      // TODO: Improve this, how do we get the nested signer config?
      const nestedSignature = encodeSignature({
        threshold: 2,
        signers: [{
          address: ethers.Wallet.createRandom().address,
          weight: 1
        }, {
          signature: (await ethers.Wallet.createRandom().signMessage("")) + '02',
          weight: 1
        }, {
          signature: (await ethers.Wallet.createRandom().signMessage("")) + '02',
          weight: 1
        }]
      }) + '03'

      return {
        weight: s.weight,
        address: s.address,
        signature: nestedSignature
      } as DecodedFullSigner
    }))})

    // Use the provided nonce
    // TODO: Maybe ignore if this fails on the MainModuleGasEstimation
    // it could help reduce the edge cases for when the gas estimation fails
    const nonce = readSequenceNonce(...transactions)
    const encoded = sequenceTxAbiEncode(transactions)

    const sequenceOverwrites = {
      [context.mainModule]: {
        code: MainModuleGasEstimation.deployedBytecode
      },
      [context.mainModuleUpgradable]: {
        code: MainModuleGasEstimation.deployedBytecode
      }
    }

    const estimates = await Promise.all([
      ...encoded.map(async (_, i) => {
        return this.estimator.estimate({
          to: wallet,
          data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [encoded.slice(0, i), nonce, stubSignature]),
          overwrites: sequenceOverwrites
        })
      }), this.estimator.estimate({
        to: wallet,     // Compute full gas estimation with all transaction
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [encoded, nonce, stubSignature]),
        overwrites: sequenceOverwrites
      })
    ])

    return {
      transactions: transactions.map((t, i) => ({ ...t, gasLimit: estimates[i + 1].sub(estimates[i]) })),
      total: estimates[estimates.length - 1]
    }
  }
}

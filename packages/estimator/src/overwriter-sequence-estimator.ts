import { OverwriterEstimator } from './overwriter-estimator'
import { walletContracts } from '@0xsequence/abi'
import { ethers, utils } from 'ethers'
import { Estimator } from './estimator'
import { commons, v2 } from '@0xsequence/core'
import { mainModuleGasEstimation } from './builds'

export class OverwriterSequenceEstimator implements Estimator {
  constructor(public estimator: OverwriterEstimator) {}

  async estimateGasLimits(
    address: string,
    config: v2.config.WalletConfig,
    context: commons.context.WalletContext,
    nonce: ethers.BigNumberish,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{ transactions: commons.transaction.Transaction[]; total: ethers.BigNumber }> {
    const walletInterface = new utils.Interface(walletContracts.mainModule.abi)

    const allSigners = await Promise.all(
      v2.config.signersOf(config.tree).map(async (s, i) => ({
        index: i,
        address: s.address,
        weight: ethers.BigNumber.from(s.weight),
        isEOA: await this.estimator.provider.getCode(s.address).then(c => ethers.utils.arrayify(c).length === 0)
      }))
    )

    let totalWeight = 0

    // Pick NOT EOA signers until we reach the threshold
    // if we can't reach the threshold, then we'll use the lowest weight EOA signers
    // TODO: if EOAs have the same weight, then we should pick the ones further apart from each other (in the tree)
    const designatedSigners = allSigners
      .sort((a, b) => {
        if (a.isEOA && !b.isEOA) return 1
        if (!a.isEOA && b.isEOA) return -1
        if (a.weight.eq(b.weight)) return a.index - b.index
        return a.weight.sub(b.weight).toNumber()
      })
      .filter(s => {
        if (totalWeight >= (config.threshold as number)) {
          return false
        } else {
          totalWeight += s.weight.toNumber()
          return true
        }
      })

    // Generate a fake signature, meant to resemble the final signature of the transaction
    // this "fake" signature is provided to compute a more accurate gas estimation
    const fakeSignatures = new Map<string, commons.signature.SignaturePart>()
    for (const s of designatedSigners) {
      if (s.isEOA) {
        fakeSignatures.set(s.address, {
          signature: (await ethers.Wallet.createRandom().signMessage('')) + '02',
          isDynamic: false
        })
      } else {
        // Assume a 2/3 nested contract signature
        const signer1 = ethers.Wallet.createRandom()
        const signer2 = ethers.Wallet.createRandom()
        const signer3 = ethers.Wallet.createRandom()

        const nestedSignature = v2.signature.encodeSigners(
          v2.config.ConfigCoder.fromSimple({
            threshold: 2,
            checkpoint: 0,
            signers: [
              {
                address: signer1.address,
                weight: 1
              },
              {
                address: signer2.address,
                weight: 1
              },
              {
                address: signer3.address,
                weight: 1
              }
            ]
          }),
          new Map([
            [signer1.address, { signature: (await signer1.signMessage('')) + '02', isDynamic: false }],
            [signer2.address, { signature: (await signer2.signMessage('')) + '02', isDynamic: false }]
          ]),
          [],
          0
        )

        fakeSignatures.set(s.address, {
          signature: nestedSignature.encoded + '03',
          isDynamic: true
        })
      }
    }

    const stubSignature = v2.signature.encodeSigners(config, fakeSignatures, [], 0).encoded

    // Use the provided nonce
    // TODO: Maybe ignore if this fails on the MainModuleGasEstimation
    // it could help reduce the edge cases for when the gas estimation fails
    const encoded = commons.transaction.sequenceTxAbiEncode(transactions)

    const sequenceOverwrites = {
      [context.mainModule]: {
        code: mainModuleGasEstimation.deployedBytecode
      },
      [context.mainModuleUpgradable]: {
        code: mainModuleGasEstimation.deployedBytecode
      }
    }

    const estimates = await Promise.all([
      ...encoded.map(async (_, i) => {
        return this.estimator.estimate({
          to: address,
          data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
            encoded.slice(0, i),
            nonce,
            stubSignature
          ]),
          overwrites: sequenceOverwrites
        })
      }),
      this.estimator.estimate({
        to: address, // Compute full gas estimation with all transaction
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

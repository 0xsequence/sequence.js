import { v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'
import { maxForBits, randomBigNumber, randomBool } from '../utils'

export function genRandomV1Config(
  threshold: ethers.BigNumberish = randomBigNumber(0, maxForBits(16)),
  numSigners: ethers.BigNumberish = randomBigNumber(1, 24)
): v1.config.WalletConfig {
  const signers: v1.config.AddressMember[] = []

  for (let i = ethers.constants.Zero; i.lt(numSigners); i = i.add(1)) {
    signers.push({
      address: ethers.Wallet.createRandom().address,
      weight: randomBigNumber(0, maxForBits(8))
    })
  }

  return { version: 1, threshold, signers }
}

export function genRandomV2Config(
  threshold: ethers.BigNumberish = randomBigNumber(0, maxForBits(16)),
  checkpoint: ethers.BigNumberish = randomBigNumber(0, maxForBits(32)),
  numSigners: ethers.BigNumberish = randomBigNumber(1, 24),
  numSubdigests: ethers.BigNumberish = randomBigNumber(0, 24),
  useMerkleTopology: boolean = randomBool()
): v2.config.WalletConfig {
  const signers: v2.config.SignerLeaf[] = []
  for (let i = ethers.constants.Zero; i.lt(numSigners); i = i.add(1)) {
    signers.push({
      address: ethers.Wallet.createRandom().address,
      weight: randomBigNumber(0, maxForBits(8))
    })
  }

  const subdigests: v2.config.SubdigestLeaf[] = []
  for (let i = ethers.constants.Zero; i.lt(numSubdigests); i = i.add(1)) {
    subdigests.push({
      subdigest: ethers.utils.hexlify(ethers.utils.randomBytes(32))
    })
  }

  const topologyBuilder = useMerkleTopology ? v2.config.merkleTopologyBuilder : v2.config.legacyTopologyBuilder
  const tree = topologyBuilder([...signers, ...subdigests])

  return { version: 2, threshold, checkpoint, tree }
}

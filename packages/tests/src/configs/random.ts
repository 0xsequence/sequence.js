import { v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'
import { maxForBits, randomBigInt, randomBool } from '../utils'
import { BigIntish } from '@0xsequence/utils'

export function genRandomV1Config(
  threshold: BigIntish = randomBigInt(0, maxForBits(16)),
  numSigners: BigIntish = randomBigInt(1, 24)
): v1.config.WalletConfig {
  const signers: v1.config.AddressMember[] = []

  for (let i = 0n; i < BigInt(numSigners); i = i + 1n) {
    signers.push({
      address: ethers.Wallet.createRandom().address,
      weight: randomBigInt(0, maxForBits(8))
    })
  }

  return { version: 1, threshold, signers }
}

export function genRandomV2Config(
  threshold: BigIntish = randomBigInt(0, maxForBits(16)),
  checkpoint: BigIntish = randomBigInt(0, maxForBits(32)),
  numSigners: BigIntish = randomBigInt(1, 24),
  numSubdigests: BigIntish = randomBigInt(0, 24),
  useMerkleTopology: boolean = randomBool()
): v2.config.WalletConfig {
  const signers: v2.config.SignerLeaf[] = []
  for (let i = 0n; i < BigInt(numSigners); i = i + 1n) {
    signers.push({
      address: ethers.Wallet.createRandom().address,
      weight: randomBigInt(0, maxForBits(8))
    })
  }

  const subdigests: v2.config.SubdigestLeaf[] = []
  for (let i = 0n; i < BigInt(numSubdigests); i = i + 1n) {
    subdigests.push({
      subdigest: ethers.toBeHex(ethers.utils.randomBytes(32))
    })
  }

  const topologyBuilder = useMerkleTopology ? v2.config.merkleTopologyBuilder : v2.config.legacyTopologyBuilder
  const tree = topologyBuilder([...signers, ...subdigests])

  return { version: 2, threshold, checkpoint, tree }
}

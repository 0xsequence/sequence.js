import { commons, universal, v1, v2 } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'
import { ethers } from 'ethers'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../../tracker'
import { Sessions, SignatureType, Transaction } from './sessions.gen'

export class RemoteConfigTracker implements ConfigTracker, migrator.PresignedMigrationTracker {
  private readonly sessions: Sessions

  constructor(
    hostname: string,
    public readonly onlyRecoverable: boolean = true
  ) {
    this.sessions = new Sessions(hostname, fetch)
  }

  async loadPresignedConfiguration(args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean
  }): Promise<PresignedConfigLink[]> {
    try {
      const { updates } = await this.sessions.configUpdates({
        wallet: args.wallet,
        fromImageHash: args.fromImageHash,
        allUpdates: args.longestPath
      })

      return updates.map(({ toImageHash, signature }) => ({ wallet: args.wallet, nextImageHash: toImageHash, signature }))
    } catch (error) {
      if (is404NotFound(error)) {
        return []
      } else {
        throw error
      }
    }
  }

  async savePresignedConfiguration(args: PresignedConfig): Promise<void> {
    const config = args.nextConfig
    const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
    const message = v2.signature.setImageHashStruct(imageHash)
    const digest = ethers.keccak256(message)

    await this.sessions.saveSignature({
      wallet: args.wallet,
      digest,
      chainID: '0',
      signature: args.signature,
      toConfig: encodeConfig(config),
      referenceChainID: args.referenceChainId !== undefined ? BigInt(args.referenceChainId).toString() : undefined
    })
  }

  async saveWitnesses(args: {
    wallet: string
    digest: string
    chainId: ethers.BigNumberish
    signatures: string[]
  }): Promise<void> {
    let filteredSignatures = args.signatures
    if (this.onlyRecoverable) {
      filteredSignatures = filteredSignatures.filter(signature => {
        return commons.signer.canRecover(signature)
      })
    }

    await this.sessions.saveSignerSignatures({
      wallet: args.wallet,
      digest: args.digest,
      chainID: numberString(args.chainId),
      signatures: filteredSignatures
    })
  }

  async configOfImageHash(args: { imageHash: string }): Promise<commons.config.Config | undefined> {
    try {
      const { version, config } = await this.sessions.config(args)
      return decodeConfig(version, config)
    } catch (error) {
      if (is404NotFound(error)) {
        return
      } else {
        throw error
      }
    }
  }

  async saveWalletConfig(args: { config: commons.config.Config }): Promise<void> {
    const config = encodeConfig(args.config)
    await this.sessions.saveConfig({ version: args.config.version, config })
  }

  async imageHashOfCounterfactualWallet(args: {
    wallet: string
  }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    try {
      const { deployHash, context } = await this.sessions.deployHash(args)
      return { imageHash: deployHash, context }
    } catch (error) {
      if (is404NotFound(error)) {
        return
      } else {
        throw error
      }
    }
  }

  async saveCounterfactualWallet(args: {
    config: commons.config.Config
    context: commons.context.WalletContext[]
  }): Promise<void> {
    const deployConfig = encodeConfig(args.config)
    await this.sessions.saveWallet({ version: args.config.version, deployConfig })
  }

  async walletsOfSigner(args: {
    signer: string
  }): Promise<{ wallet: string; proof: { digest: string; chainId: bigint; signature: string } }[]> {
    const { wallets } = await this.sessions.wallets(args)
    return Object.entries(wallets).map(([wallet, { digest, chainID, type, signature }]) => {
      switch (type) {
        case SignatureType.EIP712:
          signature += ethers.toBeHex(commons.signer.SigType.EIP712).slice(2)
          break
        case SignatureType.EthSign:
          signature += ethers.toBeHex(commons.signer.SigType.ETH_SIGN).slice(2)
          break
        case SignatureType.EIP1271:
          signature += ethers.toBeHex(commons.signer.SigType.WALLET_BYTES32).slice(2)
          break
      }

      return {
        wallet,
        proof: {
          digest,
          signature,
          chainId: BigInt(chainID)
        }
      }
    })
  }

  async getMigration(
    wallet: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    const chainIdString = numberString(chainId)
    const { migrations } = await this.sessions.migrations({ wallet, fromVersion, fromImageHash, chainID: chainIdString })

    const chooseMigration = async (chainId: string): Promise<migrator.SignedMigration | undefined> => {
      const migrations_ = migrations[chainId]
      if (migrations_) {
        const toVersions = Object.keys(migrations_)
          .map(Number)
          .sort((a: number, b: number) => b - a)

        for (const toVersion of toVersions) {
          for (const [toHash, transactions] of Object.entries(migrations_[toVersion])) {
            try {
              const toConfig = await this.configOfImageHash({ imageHash: toHash })
              if (toConfig) {
                return {
                  fromVersion,
                  toVersion,
                  toConfig,
                  tx: {
                    entrypoint: transactions.executor,
                    transactions: transactions.transactions,
                    nonce: transactions.nonce,
                    signature: transactions.signature,
                    chainId,
                    intent: {
                      id: commons.transaction.subdigestOfTransactions(
                        wallet,
                        chainId,
                        transactions.nonce,
                        transactions.transactions
                      ),
                      wallet
                    }
                  }
                }
              }
            } catch (error) {
              console.error(error)
            }
          }
        }
      }
      return
    }

    const migration = await chooseMigration(chainIdString)
    if (migration) {
      return migration
    }

    for (const chainId in migrations) {
      if (chainId !== chainIdString) {
        const migration = await chooseMigration(chainId)
        if (migration) {
          return migration
        }
      }
    }

    return
  }

  async saveMigration(
    wallet: string,
    signed: migrator.SignedMigration,
    _contexts: commons.context.VersionedContext
  ): Promise<void> {
    await this.sessions.saveMigration({
      wallet,
      fromVersion: signed.fromVersion,
      toVersion: signed.toVersion,
      toConfig: encodeConfig(signed.toConfig),
      executor: signed.tx.entrypoint,
      transactions: signed.tx.transactions.map(encodeTransaction),
      nonce: numberString(signed.tx.nonce),
      signature: signed.tx.signature,
      chainID: numberString(signed.tx.chainId)
    })
  }
}

type SessionsConfig = {
  1: { threshold: number; signers: Array<{ weight: number; address: string }> }
  2: { threshold: number; checkpoint: number; tree: V2SessionsConfigTree }
}

type V2SessionsConfigTree =
  | { left: V2SessionsConfigTree; right: V2SessionsConfigTree }
  | { weight: number; address: string }
  | { node: string }
  | { weight: number; threshold: number; tree: V2SessionsConfigTree }
  | { subdigest: string }

function encodeConfig(config: commons.config.Config): SessionsConfig[1 | 2] {
  switch (config.version) {
    case 1:
      if (v1.config.ConfigCoder.isWalletConfig(config)) {
        return {
          threshold: numberNumber(config.threshold),
          signers: config.signers.map(({ weight, address }) => ({ weight: numberNumber(weight), address }))
        }
      } else {
        throw new Error(`not a v${config.version} config: ${config}`)
      }

    case 2:
      if (v2.config.ConfigCoder.isWalletConfig(config)) {
        return {
          threshold: numberNumber(config.threshold),
          checkpoint: numberNumber(config.checkpoint),
          tree: encodeV2ConfigTree(config.tree)
        }
      } else {
        throw new Error(`not a v${config.version} config: ${config}`)
      }

    default:
      throw new Error(`unknown version ${config.version}`)
  }
}

function encodeV2ConfigTree(tree: v2.config.Topology): V2SessionsConfigTree {
  if (v2.config.isNode(tree)) {
    return {
      left: encodeV2ConfigTree(tree.left),
      right: encodeV2ConfigTree(tree.right)
    }
  } else if (v2.config.isSignerLeaf(tree)) {
    return {
      weight: numberNumber(tree.weight),
      address: tree.address
    }
  } else if (v2.config.isNestedLeaf(tree)) {
    return {
      weight: numberNumber(tree.weight),
      threshold: numberNumber(tree.threshold),
      tree: encodeV2ConfigTree(tree.tree)
    }
  } else if (v2.config.isNodeLeaf(tree)) {
    return { node: tree.nodeHash }
  } else {
    return { ...tree }
  }
}

function decodeConfig(version: number, config: any): commons.config.Config {
  switch (version) {
    case 1:
      return { ...config, version }

    case 2:
      return { ...config, version, tree: decodeV2ConfigTree(config.tree) }

    default:
      throw new Error(`unknown version ${version}`)
  }
}

function decodeV2ConfigTree(tree: any): v2.config.Topology {
  switch (typeof tree) {
    case 'object':
      const tree_ = { ...tree }

      if (tree_.left !== undefined) {
        tree_.left = decodeV2ConfigTree(tree_.left)
      }

      if (tree_.right !== undefined) {
        tree_.right = decodeV2ConfigTree(tree_.right)
      }

      if (tree_.tree !== undefined) {
        tree_.tree = decodeV2ConfigTree(tree_.tree)
      }

      if (tree_.node !== undefined) {
        tree_.nodeHash = tree_.node
        delete tree_.node
      }

      return tree_

    default:
      throw new Error(`v2 config tree ${tree} is not an object`)
  }
}

function encodeTransaction(transaction: commons.transaction.Transaction): Transaction {
  return {
    to: transaction.to,
    value: transaction.value !== undefined ? numberString(transaction.value) : undefined,
    data: transaction.data !== undefined ? ethers.hexlify(transaction.data) : undefined,
    gasLimit: transaction.gasLimit !== undefined ? numberString(transaction.gasLimit) : undefined,
    delegateCall: transaction.delegateCall,
    revertOnError: transaction.revertOnError
  }
}

function numberNumber(n: ethers.BigNumberish): number {
  return Number(n)
}

function numberString(n: ethers.BigNumberish): string {
  return BigInt(n).toString()
}

function is404NotFound(error: any): boolean {
  return typeof error === 'object' && error.status === 404
}

import { v1, commons as v2commons } from '@0xsequence/v2core'
import { WalletV1 } from '@0xsequence/v2wallet'
import { Config as V3Config, Context as V3Context, Extensions as V3Extensions } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex } from 'ox'
import { SignedMigration, UnsignedMigration, VersionedContext } from '../../migrator.js'
import { Migration } from '../index.js'
import { createDefaultV3Topology } from '../v3/config.js'

// uint160(keccak256("org.sequence.sdk.migration.v1v3.space.nonce"))
export const MIGRATION_V1_V3_NONCE_SPACE = '0x9e4d5bdafd978baf1290aff23057245a2a62bef5'

export type ConvertOptions = {
  loginSigner: {
    address: Address.Address
    imageHash?: Hex.Hex
  }
  extensions?: V3Extensions.Extensions
}

export class Migration_v1v3 implements Migration<v1.config.WalletConfig, V3Config.Config, ConvertOptions> {
  fromVersion = 1
  toVersion = 3

  async convertConfig(v1Config: v1.config.WalletConfig, options: ConvertOptions): Promise<V3Config.Config> {
    const signerLeaves: V3Config.SignerLeaf[] = v1Config.signers.map((signer) => ({
      type: 'signer',
      address: Address.from(signer.address),
      weight: BigInt(signer.weight),
    }))
    const v1NestedTopology = V3Config.flatLeavesToTopology(signerLeaves)
    const v3Config: V3Config.Config = {
      threshold: 1n,
      checkpoint: 0n,
      topology: [
        {
          type: 'nested',
          weight: 1n,
          threshold: BigInt(v1Config.threshold),
          tree: v1NestedTopology,
        },
        {
          type: 'nested',
          weight: 1n,
          threshold: 2n,
          tree: createDefaultV3Topology(options.loginSigner, options.extensions),
        },
      ],
    }
    return v3Config
  }

  async prepareMigration(
    walletAddress: Address.Address,
    contexts: VersionedContext,
    toConfig: V3Config.Config,
  ): Promise<UnsignedMigration> {
    const v3Context = contexts[3] || V3Context.Rc3
    if (!V3Context.isContext(v3Context)) {
      throw new Error('Invalid context')
    }

    const nonce = v2commons.transaction.encodeNonce(MIGRATION_V1_V3_NONCE_SPACE, 0)

    // Update implementation to v3
    const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
    const updateImplementationTx = {
      to: walletAddress,
      data: AbiFunction.encodeData(updateImplementationAbi, [v3Context.stage2]),
    }
    // Update configuration to v3
    const v3ImageHash = Hex.fromBytes(V3Config.hashConfiguration(toConfig))
    const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')
    const updateImageHashTx = {
      to: walletAddress,
      data: AbiFunction.encodeData(updateImageHashAbi, [v3ImageHash]),
    }

    return {
      transactions: [updateImplementationTx, updateImageHashTx],
      fromVersion: this.fromVersion,
      toVersion: this.toVersion,
      nonce,
    }
  }

  /**
   * Signs a migration with a wallet
   * @notice V1 Wallets must call this method for each chain they are migrating on
   * @param migration The unsigned migration to sign
   * @param wallet The wallet to sign the migration with
   * @returns The signed migration
   */
  //FIXME Remove this function. Signing is not a responsibility of the migration class.
  async signMigration(migration: UnsignedMigration, wallet: WalletV1): Promise<SignedMigration> {
    const { address } = await this.decodeTransactions(migration.transactions)
    if (address !== wallet.address) {
      throw new Error('Wallet address does not match migration address')
    }
    const txBundle: v2commons.transaction.TransactionBundle = {
      entrypoint: wallet.address,
      transactions: migration.transactions.map((tx) => ({
        to: tx.to,
        data: tx.data,
        gasLimit: 0n,
        revertOnError: true,
      })),
      nonce: migration.nonce,
    }
    const { signature } = await wallet.signTransactionBundle(txBundle)
    Hex.assert(signature)
    return { ...migration, signature }
  }

  async decodeTransactions(transactions: UnsignedMigration['transactions']): Promise<{
    address: Address.Address
    toImageHash: Hex.Hex
  }> {
    if (transactions.length !== 2) {
      throw new Error('Invalid transactions')
    }
    const tx1 = transactions[0]!
    const tx2 = transactions[1]!
    if (tx1.to !== tx2.to) {
      throw new Error('Invalid to address')
    }
    const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
    AbiFunction.decodeData(updateImplementationAbi, tx1.data) // Check decoding works for update implementation
    const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')
    const updateImageHashArgs = AbiFunction.decodeData(updateImageHashAbi, tx2.data)
    return {
      address: tx1.to,
      toImageHash: updateImageHashArgs[0],
    }
  }
}

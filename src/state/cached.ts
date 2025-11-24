import { Address, Hex } from 'ox'
import { MaybePromise, Provider } from './index.js'
import { Config, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives'
import { normalizeAddressKeys } from './utils.js'

export class Cached implements Provider {
  constructor(
    private readonly args: {
      readonly source: Provider
      readonly cache: Provider
    },
  ) {}

  async getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    const cached = await this.args.cache.getConfiguration(imageHash)
    if (cached) {
      return cached
    }
    const config = await this.args.source.getConfiguration(imageHash)

    if (config) {
      await this.args.cache.saveConfiguration(config)
    }

    return config
  }

  async getDeploy(wallet: Address.Address): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const cached = await this.args.cache.getDeploy(wallet)
    if (cached) {
      return cached
    }
    const deploy = await this.args.source.getDeploy(wallet)
    if (deploy) {
      await this.args.cache.saveDeploy(deploy.imageHash, deploy.context)
    }
    return deploy
  }

  async getWallets(signer: Address.Address): Promise<{
    [wallet: Address.Address]: {
      chainId: number
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }> {
    // Get both from cache and source
    const cached = normalizeAddressKeys(await this.args.cache.getWallets(signer))
    const source = normalizeAddressKeys(await this.args.source.getWallets(signer))

    // Merge and deduplicate
    const deduplicated = { ...cached, ...source }

    // Sync values to source that are not in cache, and vice versa
    for (const [walletAddress, data] of Object.entries(deduplicated)) {
      Address.assert(walletAddress)

      if (!source[walletAddress]) {
        await this.args.source.saveWitnesses(walletAddress, data.chainId, data.payload, {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: data.signature,
        })
      }
      if (!cached[walletAddress]) {
        await this.args.cache.saveWitnesses(walletAddress, data.chainId, data.payload, {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: data.signature,
        })
      }
    }

    return deduplicated
  }

  async getWalletsForSapient(
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): Promise<{
    [wallet: Address.Address]: {
      chainId: number
      payload: Payload.Parented
      signature: Signature.SignatureOfSapientSignerLeaf
    }
  }> {
    const cached = await this.args.cache.getWalletsForSapient(signer, imageHash)
    const source = await this.args.source.getWalletsForSapient(signer, imageHash)

    const deduplicated = { ...cached, ...source }

    // Sync values to source that are not in cache, and vice versa
    for (const [wallet, data] of Object.entries(deduplicated)) {
      const walletAddress = Address.from(wallet)
      if (!source[walletAddress]) {
        await this.args.source.saveWitnesses(walletAddress, data.chainId, data.payload, {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: data.signature,
        })
      }
      if (!cached[walletAddress]) {
        await this.args.cache.saveWitnesses(walletAddress, data.chainId, data.payload, {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: data.signature,
        })
      }
    }

    return deduplicated
  }

  async getWitnessFor(
    wallet: Address.Address,
    signer: Address.Address,
  ): Promise<{ chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined> {
    const cached = await this.args.cache.getWitnessFor(wallet, signer)
    if (cached) {
      return cached
    }

    const source = await this.args.source.getWitnessFor(wallet, signer)
    if (source) {
      await this.args.cache.saveWitnesses(wallet, source.chainId, source.payload, {
        type: 'unrecovered-signer',
        weight: 1n,
        signature: source.signature,
      })
    }

    return source
  }

  async getWitnessForSapient(
    wallet: Address.Address,
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): Promise<
    { chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined
  > {
    const cached = await this.args.cache.getWitnessForSapient(wallet, signer, imageHash)
    if (cached) {
      return cached
    }
    const source = await this.args.source.getWitnessForSapient(wallet, signer, imageHash)
    if (source) {
      await this.args.cache.saveWitnesses(wallet, source.chainId, source.payload, {
        type: 'unrecovered-signer',
        weight: 1n,
        signature: source.signature,
      })
    }
    return source
  }

  async getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
    // TODO: Cache this
    return this.args.source.getConfigurationUpdates(wallet, fromImageHash, options)
  }

  async getTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const cached = await this.args.cache.getTree(rootHash)
    if (cached) {
      return cached
    }
    const source = await this.args.source.getTree(rootHash)
    if (source) {
      await this.args.cache.saveTree(source)
    }
    return source
  }

  // Write methods are not cached, they are directly forwarded to the source
  saveWallet(deployConfiguration: Config.Config, context: Context.Context): MaybePromise<void> {
    return this.args.source.saveWallet(deployConfiguration, context)
  }

  saveWitnesses(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): MaybePromise<void> {
    return this.args.source.saveWitnesses(wallet, chainId, payload, signatures)
  }

  saveUpdate(
    wallet: Address.Address,
    configuration: Config.Config,
    signature: Signature.RawSignature,
  ): MaybePromise<void> {
    return this.args.source.saveUpdate(wallet, configuration, signature)
  }

  saveTree(tree: GenericTree.Tree): MaybePromise<void> {
    return this.args.source.saveTree(tree)
  }

  saveConfiguration(config: Config.Config): MaybePromise<void> {
    return this.args.source.saveConfiguration(config)
  }

  saveDeploy(imageHash: Hex.Hex, context: Context.Context): MaybePromise<void> {
    return this.args.source.saveDeploy(imageHash, context)
  }

  async getPayload(opHash: Hex.Hex): Promise<
    | {
        chainId: number
        payload: Payload.Parented
        wallet: Address.Address
      }
    | undefined
  > {
    const cached = await this.args.cache.getPayload(opHash)
    if (cached) {
      return cached
    }

    const source = await this.args.source.getPayload(opHash)
    if (source) {
      await this.args.cache.savePayload(source.wallet, source.payload, source.chainId)
    }
    return source
  }

  savePayload(wallet: Address.Address, payload: Payload.Parented, chainId: number): MaybePromise<void> {
    return this.args.source.savePayload(wallet, payload, chainId)
  }
}

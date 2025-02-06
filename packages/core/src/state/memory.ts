import {
  Configuration,
  decodeSignature,
  fromConfigUpdate,
  getCounterfactualAddress,
  hash,
  hashConfiguration,
  Payload,
  recover,
} from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex } from 'ox'
import { Signature, StateReader, StateWriter } from '.'

export class MemoryStore implements StateReader, StateWriter {
  private readonly objects: {
    configurations: { [imageHash: Hex.Hex]: Configuration }
    deployHashes: { [wallet: Address.Address]: Hex.Hex }
    wallets: {
      [signer: Address.Address]: {
        [wallet: Address.Address]: { chainId: bigint; digest: Hex.Hex; signature: Signature }
      }
    }
    configurationPaths: {
      [wallet: Address.Address]: {
        updates: Array<{ imageHash: Hex.Hex; signature: Hex.Hex }>
        index: { [imageHash: Hex.Hex]: number }
      }
    }
  } = { configurations: {}, deployHashes: {}, wallets: {}, configurationPaths: {} }

  getConfiguration(imageHash: Hex.Hex): Configuration {
    const configuration = this.objects.configurations[imageHash]
    if (!configuration) {
      throw new Error(`no configuration ${imageHash}`)
    }
    return configuration
  }

  getDeployHash(wallet: Address.Address): Hex.Hex {
    const deployHash = this.objects.deployHashes[wallet]
    if (!deployHash) {
      throw new Error(`no deploy hash for wallet ${wallet}`)
    }
    return deployHash
  }

  getWallets(
    signer: Address.Address,
  ): Array<{ wallet: Address.Address; chainId: bigint; digest: Hex.Hex; signature: Signature }> {
    const wallets = this.objects.wallets[signer]
    if (!wallets) {
      throw new Error(`no wallets for signer ${signer}`)
    }
    return Object.entries(wallets).map(([wallet, signature]) => {
      Address.assert(wallet)
      return { wallet, ...signature }
    })
  }

  getConfigurationPath(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Array<{ imageHash: Hex.Hex; signature: Hex.Hex }> {
    const configurationPath = this.objects.configurationPaths[wallet]
    if (!configurationPath) {
      throw new Error(`no configuration path for wallet ${wallet}`)
    }

    let index = configurationPath.index[fromImageHash]
    if (index === undefined) {
      throw new Error(`no configuration path for wallet ${wallet} from ${fromImageHash}`)
    }

    if (options?.allUpdates) {
      return configurationPath.updates.slice(index + 1)
    }

    const updates: Array<{ imageHash: Hex.Hex; signature: Hex.Hex }> = []
    while (index + 1 < configurationPath.updates.length) {
      for (let next = configurationPath.updates.length - 1; next > index; next--) {
        if (next === index + 1) {
          updates.push(configurationPath.updates[next]!)
          index = next
          break
        }
      }
    }
    return updates
  }

  saveWallet(deployConfiguration: Configuration): void {
    const deployHash = hashConfiguration(deployConfiguration)
    const wallet = getCounterfactualAddress(deployHash)
    this.objects.configurations[Bytes.toHex(deployHash)] = deployConfiguration
    this.objects.deployHashes[wallet] = Bytes.toHex(deployHash)

    let configurationPath = this.objects.configurationPaths[wallet]
    if (!configurationPath) {
      configurationPath = { updates: [], index: {} }
      this.objects.configurationPaths[wallet] = configurationPath
    }
    configurationPath.index[Bytes.toHex(deployHash)] = -1
  }

  saveWitness(
    signer: Address.Address,
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload,
    signature: Signature<number | undefined>,
  ): void {
    if (signature.type === 'erc-1271' && signature.validAt.block === undefined) {
      throw new Error('memory store requires block number where erc-1271 signature is valid')
    }
    let wallets = this.objects.wallets[signer]
    if (!wallets) {
      wallets = {}
      this.objects.wallets[signer] = wallets
    }
    if (wallets[wallet]) {
      return
    }
    wallets[wallet] = {
      chainId,
      digest: Bytes.toHex(hash(wallet, chainId, payload)),
      signature: signature as Signature,
    }
  }

  async setConfiguration(wallet: Address.Address, configuration: Configuration, signature: Hex.Hex): Promise<void> {
    const configurationPath = this.objects.configurationPaths[wallet]
    if (!configurationPath) {
      throw new Error(`no configuration path for wallet ${wallet}`)
    }

    let latestImageHash: Hex.Hex
    if (configurationPath.updates.length) {
      latestImageHash = configurationPath.updates[configurationPath.updates.length - 1]!.imageHash
    } else {
      const deployHash = this.objects.deployHashes[wallet]
      if (!deployHash) {
        throw new Error(`no deploy hash for wallet ${wallet}`)
      }
      latestImageHash = deployHash
    }

    const latestConfiguration = this.objects.configurations[latestImageHash]
    if (!latestConfiguration) {
      throw new Error(`no configuration ${latestImageHash}`)
    }

    if (configuration.checkpoint <= latestConfiguration.checkpoint) {
      throw new Error(
        `configuration checkpoint ${configuration.checkpoint} <= latest checkpoint ${latestConfiguration.checkpoint}`,
      )
    }

    const { configuration: recovered, weight } = await recover(
      decodeSignature(Hex.toBytes(signature)),
      wallet,
      0n,
      fromConfigUpdate(Bytes.toHex(hashConfiguration(configuration))),
    )
    if (weight < recovered.threshold) {
      throw new Error(`invalid signature: weight ${weight} < threshold ${recovered.threshold}`)
    }
    const recoveredImageHash = Bytes.toHex(hashConfiguration(recovered))
    if (recoveredImageHash !== latestImageHash) {
      throw new Error(`invalid signature: recovered ${recoveredImageHash} != latest ${latestImageHash}`)
    }

    configurationPath.updates.push({ imageHash: Bytes.toHex(hashConfiguration(configuration)), signature })
  }
}

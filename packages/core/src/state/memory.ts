import {
  Configuration,
  getCounterfactualAddress,
  hash,
  hashConfiguration,
  Payload,
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
  } = { configurations: {}, deployHashes: {}, wallets: {} }

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
  ): Array<{ imageHash: Hex.Hex; signature: Hex.Hex }> {}

  saveWallet(deployConfiguration: Configuration): void {
    const deployHash = hashConfiguration(deployConfiguration)
    const wallet = getCounterfactualAddress(deployHash)
    this.objects.configurations[Bytes.toHex(deployHash)] = deployConfiguration
    this.objects.deployHashes[wallet] = Bytes.toHex(deployHash)
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

  setConfiguration(wallet: Address.Address, configuration: Configuration, signature: Hex.Hex): void {}
}

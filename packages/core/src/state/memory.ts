import { Address, Bytes, Hex, PersonalMessage, Secp256k1, Signature } from 'ox'
import { StateProvider } from '.'
import {
  Context,
  WalletConfig,
  Payload,
  Signature as SequenceSignature,
  Address as SequenceAddress,
} from '@0xsequence/sequence-primitives'

export class MemoryStateProvider implements StateProvider {
  private readonly objects: {
    configurations: { [imageHash: Hex.Hex]: WalletConfig.Configuration }
    deployHashes: { [wallet: Address.Address]: { deployHash: Hex.Hex; context: Context.Context } }
    wallets: {
      [signer: Address.Address]: {
        [wallet: Address.Address]: {
          chainId: bigint
          payload: Payload.Parented
          signature: SequenceSignature.SignatureOfSignerLeaf
        }
      }
    }
    configurationUpdates: {
      [wallet: Address.Address]: {
        configurations: Hex.Hex[]
        signerSignatures: {
          [imageHash: Hex.Hex]: { [signer: Address.Address]: SequenceSignature.SignatureOfSignerLeaf }
        }
      }
    }
  } = { configurations: {}, deployHashes: {}, wallets: {}, configurationUpdates: {} }

  getConfiguration(imageHash: Hex.Hex): WalletConfig.Configuration {
    const configuration = this.objects.configurations[imageHash]
    if (!configuration) {
      throw new Error(`unknown configuration ${imageHash}`)
    }
    return configuration
  }

  getDeployHash(wallet: Address.Address): { deployHash: Hex.Hex; context: Context.Context } {
    const deployHash = this.objects.deployHashes[wallet]
    if (!deployHash) {
      throw new Error(`no known deploy hash for ${wallet}`)
    }
    return deployHash
  }

  getWallets(signer: Address.Address): {
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: SequenceSignature.SignatureOfSignerLeaf
    }
  } {
    return this.objects.wallets[signer] ?? {}
  }

  async getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: SequenceSignature.RawSignature }>> {
    const objects = this.objects.configurationUpdates[wallet]
    if (!objects) {
      throw new Error(`unknown wallet ${wallet}`)
    }

    let imageHash = fromImageHash
    let index = objects.configurations.lastIndexOf(imageHash)
    if (index === -1) {
      throw new Error(`no configuration update to ${imageHash} by ${wallet}`)
    }
    let configuration = this.getConfiguration(imageHash)

    const updates: Unpromise<ReturnType<typeof this.getConfigurationUpdates>> = []
    while (index + 1 < objects.configurations.length) {
      const append = async (i: number): Promise<void> => {
        const toImageHash = objects.configurations[i]
        if (!toImageHash) {
          throw new Error(`no configuration at index ${i}`)
        }

        updates.push({
          imageHash: toImageHash,
          signature: {
            noChainId: true,
            configuration: {
              ...configuration,
              topology: await WalletConfig.sign(
                configuration.topology,
                {
                  sign: (leaf) => {
                    const signature = objects.signerSignatures[toImageHash]?.[leaf.address]
                    if (!signature) {
                      throw new Error(`no signature for signer ${leaf.address}`)
                    }
                    return signature
                  },
                },
                { threshold: configuration.threshold },
              ),
            },
          },
        })

        imageHash = toImageHash
        configuration = this.getConfiguration(imageHash)
      }

      if (options?.allUpdates) {
        for (let i = index + 1; i < objects.configurations.length; i++) {
          try {
            await append(i)
            index = i
            break
          } catch {}
        }
      } else {
        for (let i = objects.configurations.length - 1; i > index; i--) {
          try {
            await append(i)
            index = i
            break
          } catch {}
        }
      }
    }

    return updates
  }

  saveWallet(deployConfiguration: WalletConfig.Configuration, context: Context.Context) {
    const deployHashBytes = WalletConfig.hashConfiguration(deployConfiguration)
    const deployHash = Bytes.toHex(deployHashBytes)
    const wallet = SequenceAddress.from(deployHashBytes, context)
    this.objects.configurations[deployHash] = deployConfiguration
    this.objects.deployHashes[wallet] = { deployHash, context }
    this.objects.configurationUpdates[wallet] = { configurations: [deployHash], signerSignatures: {} }
  }

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: SequenceSignature.SignatureOfSignerLeaf[],
  ) {
    const digest = Payload.hash(wallet, chainId, payload)

    signatures.forEach((signature) => {
      let signer: Address.Address
      switch (signature.type) {
        case 'eth_sign':
        case 'hash':
          signer = Secp256k1.recoverAddress({
            payload: signature.type === 'eth_sign' ? PersonalMessage.getSignPayload(digest) : digest,
            signature: {
              r: Bytes.toBigInt(signature.r),
              s: Bytes.toBigInt(signature.s),
              yParity: Signature.vToYParity(signature.v),
            },
          })
          break

        case 'erc1271':
          signer = signature.address
          break
      }

      let wallets = this.objects.wallets[signer]
      if (!wallets) {
        wallets = {}
        this.objects.wallets[signer] = wallets
      }
      wallets[wallet] = { chainId, payload, signature }
    })
  }

  setConfiguration(
    wallet: Address.Address,
    configuration: WalletConfig.Configuration,
    signature: SequenceSignature.RawSignature,
  ) {
    const configurations = this.objects.configurationUpdates[wallet]?.configurations
    if (configurations?.length) {
      const latestImageHash = configurations[configurations.length - 1]!
      const latestConfiguration = this.getConfiguration(latestImageHash)
      if (configuration.checkpoint <= latestConfiguration.checkpoint) {
        throw new Error(`checkpoint ${configuration.checkpoint} <= latest checkpoint ${latestConfiguration.checkpoint}`)
      }
    }

    const imageHash = Bytes.toHex(WalletConfig.hashConfiguration(configuration))
    const digest = Payload.hash(wallet, 0n, Payload.fromConfigUpdate(imageHash))

    const search = (topology: SequenceSignature.RawTopology) => {
      if (SequenceSignature.isSignedSignerLeaf(topology)) {
        switch (topology.signature.type) {
          case 'eth_sign':
          case 'hash':
            let updates = this.objects.configurationUpdates[wallet]
            if (!updates) {
              updates = { configurations: [], signerSignatures: {} }
              this.objects.configurationUpdates[wallet] = updates
            }
            updates.configurations.push(imageHash)

            let signatures = updates.signerSignatures[imageHash]
            if (!signatures) {
              signatures = {}
              updates.signerSignatures[imageHash] = signatures
            }
            signatures[topology.address] = topology.signature
            break
        }
      } else if (WalletConfig.isSignerLeaf(topology)) {
        return
      } else if (WalletConfig.isSapientSignerLeaf(topology)) {
        return
      } else if (WalletConfig.isSubdigestLeaf(topology)) {
        return
      } else if (WalletConfig.isAnyAddressSubdigestLeaf(topology)) {
        return
      } else if (WalletConfig.isNodeLeaf(topology)) {
        return
      } else if (SequenceSignature.isRawSignerLeaf(topology)) {
        let updates = this.objects.configurationUpdates[wallet]
        if (!updates) {
          updates = { configurations: [], signerSignatures: {} }
          this.objects.configurationUpdates[wallet] = updates
        }
        updates.configurations.push(imageHash)

        let signatures = updates.signerSignatures[imageHash]
        if (!signatures) {
          signatures = {}
          updates.signerSignatures[imageHash] = signatures
        }
        switch (topology.signature.type) {
          case 'eth_sign':
          case 'hash':
            signatures[
              Secp256k1.recoverAddress({
                payload: topology.signature.type === 'eth_sign' ? PersonalMessage.getSignPayload(digest) : digest,
                signature: {
                  r: Bytes.toBigInt(topology.signature.r),
                  s: Bytes.toBigInt(topology.signature.s),
                  yParity: Signature.vToYParity(topology.signature.v),
                },
              })
            ] = topology.signature
            break
        }
      } else if (SequenceSignature.isRawNestedLeaf(topology)) {
        search(topology.tree)
      } else {
        search(topology[0])
        search(topology[1])
      }
    }

    search(signature.configuration.topology)
  }
}

type Unpromise<T> = T extends Promise<infer S> ? S : T

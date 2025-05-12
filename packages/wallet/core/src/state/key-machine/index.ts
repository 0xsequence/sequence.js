import { Config, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex, Signature as oxSignature } from 'ox'

import { Provider } from '..'
import { Sessions, SignatureType } from './sessions.gen'

export class KeyMachine implements Provider {
  private readonly service: Sessions

  constructor(host: string = 'https://sessions.sequence.app') {
    this.service = new Sessions(host, fetch)
  }

  async getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    const { version, config } = await this.service.config({ imageHash })

    if (version !== 3) {
      throw new Error(`unknown configuration version ${version}, expected 3`)
    }

    return decodeConfig(config)
  }

  async getDeploy(wallet: Address.Address): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const { deployHash, context } = await this.service.deployHash({ wallet })

    Hex.assert(deployHash)
    Address.assert(context.factory)
    Address.assert(context.mainModule)
    Hex.assert(context.walletCreationCode)

    return {
      imageHash: deployHash,
      context: { factory: context.factory, stage1: context.mainModule, creationCode: context.walletCreationCode },
    }
  }

  async getWallets(signer: Address.Address): Promise<{
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }> {
    const { wallets } = await this.service.wallets({ signer })

    return Object.fromEntries(
      Object.entries(wallets).map(([wallet, signature]) => {
        Address.assert(wallet)
        Hex.assert(signature.signature)

        if (signature.payload === undefined) {
          throw new Error('no payload for wallet signature')
        }

        switch (signature.type) {
          case SignatureType.EIP712:
            return [
              wallet,
              {
                chainId: BigInt(signature.chainID),
                payload: signature.payload,
                signature: { type: 'hash', ...oxSignature.from(signature.signature) },
              },
            ] as const

          case SignatureType.EthSign:
            return [
              wallet,
              {
                chainId: BigInt(signature.chainID),
                payload: signature.payload,
                signature: { type: 'eth_sign', ...oxSignature.from(signature.signature) },
              },
            ] as const

          case SignatureType.EIP1271:
            return [
              wallet,
              {
                chainId: BigInt(signature.chainID),
                payload: signature.payload,
                signature: { type: 'erc1271', address: signer, data: Hex.toBytes(signature.signature) },
              },
            ] as const

          default:
            throw new Error(`unexpected ${signature.type} signature`)
        }
      }),
    )
  }

  async getWalletsForSapient(
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): Promise<{
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSapientSignerLeaf
    }
  }> {
    const { wallets } = await this.service.wallets({ signer, sapientHash: imageHash })

    return Object.fromEntries(
      Object.entries(wallets).map(([wallet, signature]) => {
        Address.assert(wallet)
        Hex.assert(signature.signature)
        Hex.assert(signature.sapientHash)

        if (signature.payload === undefined) {
          throw new Error('no payload for wallet sapient signature')
        }

        switch (signature.type) {
          case SignatureType.Sapient:
            return [wallet, { type: 'sapient', address: signer, data: Hex.toBytes(signature.signature) }] as const

          case SignatureType.SapientCompact:
            return [
              wallet,
              { type: 'sapient_compact', address: signer, data: Hex.toBytes(signature.signature) },
            ] as const

          default:
            throw new Error(`unexpected ${signature.type} signature`)
        }
      }),
    )
  }

  async getWitnessFor(
    wallet: Address.Address,
    signer: Address.Address,
  ): Promise<{ chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined> {
    const { witness } = await this.service.witness({ signer, wallet })

    Hex.assert(witness.signature)

    if (witness.payload === undefined) {
      throw new Error('no payload for witness')
    }

    switch (witness.type) {
      case SignatureType.EIP712:
        return {
          chainId: BigInt(witness.chainID),
          payload: witness.payload,
          signature: { type: 'hash', ...oxSignature.from(witness.signature) },
        }

      case SignatureType.EthSign:
        return {
          chainId: BigInt(witness.chainID),
          payload: witness.payload,
          signature: { type: 'eth_sign', ...oxSignature.from(witness.signature) },
        }

      case SignatureType.EIP1271:
        return {
          chainId: BigInt(witness.chainID),
          payload: witness.payload,
          signature: { type: 'erc1271', address: signer, data: Hex.toBytes(witness.signature) },
        }

      default:
        throw new Error(`unexpected ${witness.type} signature`)
    }
  }

  async getWitnessForSapient(
    wallet: Address.Address,
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): Promise<
    { chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined
  > {
    const { witness } = await this.service.witness({ signer, wallet, sapientHash: imageHash })

    Hex.assert(witness.signature)

    if (witness.payload === undefined) {
      throw new Error('no payload for sapient witness')
    }

    switch (witness.type) {
      case SignatureType.Sapient:
        return {
          chainId: BigInt(witness.chainID),
          payload: witness.payload,
          signature: { type: 'sapient', address: signer, data: Hex.toBytes(witness.signature) },
        }

      case SignatureType.SapientCompact:
        return {
          chainId: BigInt(witness.chainID),
          payload: witness.payload,
          signature: { type: 'sapient_compact', address: signer, data: Hex.toBytes(witness.signature) },
        }

      default:
        throw new Error(`unexpected ${witness.type} signature`)
    }
  }

  async getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
    const { updates } = await this.service.configUpdates({ wallet, fromImageHash, allUpdates: options?.allUpdates })

    return updates.map(({ toImageHash, signature }) => {
      Hex.assert(toImageHash)
      Hex.assert(signature)

      return { imageHash: toImageHash, signature: Signature.decodeSignature(Hex.toBytes(signature)) }
    })
  }

  async getTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const { version, tree } = await this.service.tree({ imageHash: rootHash })

    if (version !== 3) {
      throw new Error(`unknown tree version ${version}, expected 3`)
    }

    return decodeTree(tree)
  }

  async saveWallet(deployConfiguration: Config.Config, _context: Context.Context): Promise<void> {
    await this.service.saveWallet({ version: 3, deployConfig: encodeConfig(deployConfiguration) })
  }

  async saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): Promise<void> {
    await this.service.saveSignerSignatures3({
      wallet,
      payload,
      chainID: chainId.toString(),
      signatures: getSignerSignatures(signatures).map((signature) => {
        switch (signature.type) {
          case 'eth_sign':
            return { type: SignatureType.EthSign, signature: oxSignature.toHex(signature) }

          case 'hash':
            return { type: SignatureType.EIP712, signature: oxSignature.toHex(signature) }

          case 'erc1271':
            return {
              type: SignatureType.EIP1271,
              signer: signature.address,
              signature: Bytes.toHex(signature.data),
              referenceChainID: chainId.toString(),
            }

          case 'sapient':
            return {
              type: SignatureType.Sapient,
              signer: signature.address,
              signature: Bytes.toHex(signature.data),
              referenceChainID: chainId.toString(),
            }

          case 'sapient_compact':
            return {
              type: SignatureType.SapientCompact,
              signer: signature.address,
              signature: Bytes.toHex(signature.data),
              referenceChainID: chainId.toString(),
            }
        }
      }),
    })
  }

  async saveUpdate(
    wallet: Address.Address,
    configuration: Config.Config,
    signature: Signature.RawSignature,
  ): Promise<void> {
    await this.service.saveSignature2({
      wallet,
      chainID: '0',
      payload: Payload.fromConfigUpdate(Bytes.toHex(Config.hashConfiguration(configuration))),
      signature: Bytes.toHex(Signature.encodeSignature(signature)),
    })
  }

  async saveTree(tree: GenericTree.Tree): Promise<void> {
    await this.service.saveTree({ version: 3, tree: encodeTree(tree) })
  }
}

function encodeConfig(config: Config.Config) {
  return {
    threshold: Number(config.threshold),
    checkpoint: Number(config.checkpoint),
    topology: encodeTopology(config.topology),
    checkpointer: config.checkpointer,
  }
}

function encodeTopology(topology: Config.Topology): any {
  if (Config.isNode(topology)) {
    return [encodeTopology(topology[0]), encodeTopology(topology[1])]
  } else if (Config.isSignerLeaf(topology)) {
    return { weight: Number(topology.weight), address: topology.address }
  } else if (Config.isSapientSignerLeaf(topology)) {
    return { weight: Number(topology.weight), address: topology.address, imageHash: topology.imageHash }
  } else if (Config.isSubdigestLeaf(topology)) {
    return { subdigest: Bytes.toHex(topology.digest) }
  } else if (Config.isAnyAddressSubdigestLeaf(topology)) {
    return { subdigest: Bytes.toHex(topology.digest), isAnyAddress: true }
  } else if (Config.isNestedLeaf(topology)) {
    return {
      weight: Number(topology.weight),
      threshold: Number(topology.threshold),
      tree: encodeTopology(topology.tree),
    }
  } else if (Config.isNodeLeaf(topology)) {
    return Bytes.toHex(topology)
  } else {
    throw new Error(`unknown topology '${JSON.stringify(topology)}'`)
  }
}

function decodeConfig(config: any): Config.Config {
  if (config.checkpointer !== undefined) {
    Address.assert(config.checkpointer)
  }

  return {
    threshold: BigInt(config.threshold),
    checkpoint: BigInt(config.checkpoint),
    checkpointer: config.checkpointer,
    topology: decodeTopology(config.topology),
  }
}

function decodeTopology(topology: any): Config.Topology {
  if (topology instanceof Array) {
    if (topology.length === 2) {
      return [decodeTopology(topology[0]), decodeTopology(topology[1])]
    } else {
      throw new Error(`node has ${topology.length} children, expected 2`)
    }
  } else if (typeof topology === 'string') {
    Hex.assert(topology)
    return Hex.toBytes(topology)
  } else if (topology.isAnyAddress) {
    Hex.assert(topology.subdigest)
    return { type: 'any-address-subdigest', digest: Hex.toBytes(topology.subdigest) }
  } else if (topology.subdigest) {
    Hex.assert(topology.subdigest)
    return { type: 'subdigest', digest: Hex.toBytes(topology.subdigest) }
  } else if (topology.tree) {
    return {
      type: 'nested',
      weight: BigInt(topology.weight),
      threshold: BigInt(topology.threshold),
      tree: decodeTopology(topology.tree),
    }
  } else if (topology.imageHash) {
    Address.assert(topology.address)
    Hex.assert(topology.imageHash)
    return {
      type: 'sapient-signer',
      weight: BigInt(topology.weight),
      address: topology.address,
      imageHash: topology.imageHash,
    }
  } else if (topology.address) {
    Address.assert(topology.address)
    return { type: 'signer', weight: BigInt(topology.weight), address: topology.address }
  } else {
    throw new Error(`unable to decode topology '${JSON.stringify(topology)}'`)
  }
}

function encodeTree(tree: GenericTree.Tree): any {
  if (GenericTree.isBranch(tree)) {
    return tree.map(encodeTree)
  } else if (GenericTree.isLeaf(tree)) {
    return { ...tree, value: Bytes.toHex(tree.value) }
  } else {
    return tree
  }
}

function decodeTree(tree: any): GenericTree.Tree {
  if (tree instanceof Array) {
    if (tree.length >= 2) {
      return [decodeTree(tree[0]), decodeTree(tree[1]), ...tree.slice(2).map(decodeTree)]
    } else {
      throw new Error(`node has ${tree.length} children, expected at least 2`)
    }
  } else if (typeof tree === 'string') {
    Hex.assert(tree)
    return tree
  } else if (tree.type === 'leaf') {
    Hex.assert(tree.value)
    return { type: 'leaf', value: Hex.toBytes(tree.value) }
  } else {
    throw new Error(`unable to decode tree '${JSON.stringify(tree)}'`)
  }
}

function getSignerSignatures(
  topology: Signature.RawTopology,
): Array<Signature.SignatureOfSignerLeaf | Signature.SignatureOfSapientSignerLeaf> {
  if (Signature.isRawNode(topology)) {
    return [...getSignerSignatures(topology[0]), ...getSignerSignatures(topology[1])]
  } else if (Signature.isRawSignerLeaf(topology)) {
    return [topology.signature]
  } else if (Signature.isRawNestedLeaf(topology)) {
    return getSignerSignatures(topology.tree)
  } else if (Config.isNodeLeaf(topology)) {
    return []
  } else if (Config.isSignerLeaf(topology)) {
    return topology.signature ? [topology.signature] : []
  } else if (Config.isSapientSignerLeaf(topology)) {
    return topology.signature ? [topology.signature] : []
  } else if (Config.isSubdigestLeaf(topology)) {
    return []
  } else if (Config.isAnyAddressSubdigestLeaf(topology)) {
    return []
  } else {
    throw new Error(`unknown topology ${topology}`)
  }
}

import { Address, Config, Constants, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives'
import { Bytes, Hex, Signature as oxSignature } from 'ox'
import { Provider as ProviderInterface } from '../index.js'
import { Sessions, SignatureType } from './sessions.gen.js'

export class Provider implements ProviderInterface {
  private readonly service: Sessions

  constructor(host = 'https://v3-keymachine.sequence-dev.app') {
    this.service = new Sessions(host, fetch)
  }

  async getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    const { version, config } = await this.service.config({ imageHash })

    if (version !== 3) {
      throw new Error(`invalid configuration version ${version}, expected version 3`)
    }

    return fromServiceConfig(config)
  }

  async getDeploy(wallet: Address.Checksummed): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const { deployHash, context } = await this.service.deployHash({ wallet })

    Hex.assert(deployHash)
    Hex.assert(context.walletCreationCode)

    return {
      imageHash: deployHash,
      context: {
        factory: Address.checksum(context.factory),
        stage1: Address.checksum(context.mainModule),
        stage2: Address.checksum(context.mainModuleUpgradable),
        creationCode: context.walletCreationCode,
      },
    }
  }

  async getWallets(signer: Address.Checksummed): Promise<{
    [wallet: Address.Checksummed]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }> {
    const { wallets } = await this.service.wallets({ signer })

    return Object.fromEntries(
      Object.entries(wallets).map(
        ([wallet, signature]): [
          Address.Checksummed,
          {
            chainId: bigint
            payload: Payload.Parented
            signature: Signature.SignatureOfSignerLeaf
          },
        ] => {
          Hex.assert(signature.signature)

          switch (signature.type) {
            case SignatureType.EIP712:
              return [
                Address.checksum(wallet),
                {
                  chainId: BigInt(signature.chainID),
                  payload: fromServicePayload(signature.payload),
                  signature: { type: 'hash', ...oxSignature.from(signature.signature) },
                },
              ]
            case SignatureType.EthSign:
              return [
                Address.checksum(wallet),
                {
                  chainId: BigInt(signature.chainID),
                  payload: fromServicePayload(signature.payload),
                  signature: { type: 'eth_sign', ...oxSignature.from(signature.signature) },
                },
              ]
            case SignatureType.EIP1271:
              return [
                Address.checksum(wallet),
                {
                  chainId: BigInt(signature.chainID),
                  payload: fromServicePayload(signature.payload),
                  signature: { type: 'erc1271', address: signer, data: signature.signature },
                },
              ]
            case SignatureType.Sapient:
              throw new Error(`unexpected sapient signature by ${signer}`)
            case SignatureType.SapientCompact:
              throw new Error(`unexpected compact sapient signature by ${signer}`)
          }
        },
      ),
    )
  }

  async getWalletsForSapient(
    signer: Address.Checksummed,
    imageHash: Hex.Hex,
  ): Promise<{
    [wallet: Address.Checksummed]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSapientSignerLeaf
    }
  }> {
    const { wallets } = await this.service.wallets({ signer, sapientHash: imageHash })

    return Object.fromEntries(
      Object.entries(wallets).map(
        ([wallet, signature]): [
          Address.Checksummed,
          {
            chainId: bigint
            payload: Payload.Parented
            signature: Signature.SignatureOfSapientSignerLeaf
          },
        ] => {
          Hex.assert(signature.signature)

          switch (signature.type) {
            case SignatureType.EIP712:
              throw new Error(`unexpected eip-712 signature by ${signer}`)
            case SignatureType.EthSign:
              throw new Error(`unexpected eth_sign signature by ${signer}`)
            case SignatureType.EIP1271:
              throw new Error(`unexpected erc-1271 signature by ${signer}`)
            case SignatureType.Sapient:
              return [
                Address.checksum(wallet),
                {
                  chainId: BigInt(signature.chainID),
                  payload: fromServicePayload(signature.payload),
                  signature: { type: 'sapient', address: signer, data: signature.signature },
                },
              ]
            case SignatureType.SapientCompact:
              return [
                Address.checksum(wallet),
                {
                  chainId: BigInt(signature.chainID),
                  payload: fromServicePayload(signature.payload),
                  signature: { type: 'sapient_compact', address: signer, data: signature.signature },
                },
              ]
          }
        },
      ),
    )
  }

  async getWitnessFor(
    wallet: Address.Checksummed,
    signer: Address.Checksummed,
  ): Promise<{ chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined> {
    try {
      const { witness } = await this.service.witness({ signer, wallet })

      Hex.assert(witness.signature)

      switch (witness.type) {
        case SignatureType.EIP712:
          return {
            chainId: BigInt(witness.chainID),
            payload: fromServicePayload(witness.payload),
            signature: { type: 'hash', ...oxSignature.from(witness.signature) },
          }
        case SignatureType.EthSign:
          return {
            chainId: BigInt(witness.chainID),
            payload: fromServicePayload(witness.payload),
            signature: { type: 'eth_sign', ...oxSignature.from(witness.signature) },
          }
        case SignatureType.EIP1271:
          return {
            chainId: BigInt(witness.chainID),
            payload: fromServicePayload(witness.payload),
            signature: { type: 'erc1271', address: signer, data: witness.signature },
          }
        case SignatureType.Sapient:
          throw new Error(`unexpected sapient signature by ${signer}`)
        case SignatureType.SapientCompact:
          throw new Error(`unexpected compact sapient signature by ${signer}`)
      }
    } catch {}
  }

  async getWitnessForSapient(
    wallet: Address.Checksummed,
    signer: Address.Checksummed,
    imageHash: Hex.Hex,
  ): Promise<
    { chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined
  > {
    try {
      const { witness } = await this.service.witness({ signer, wallet, sapientHash: imageHash })

      Hex.assert(witness.signature)

      switch (witness.type) {
        case SignatureType.EIP712:
          throw new Error(`unexpected eip-712 signature by ${signer}`)
        case SignatureType.EthSign:
          throw new Error(`unexpected eth_sign signature by ${signer}`)
        case SignatureType.EIP1271:
          throw new Error(`unexpected erc-1271 signature by ${signer}`)
        case SignatureType.Sapient:
          return {
            chainId: BigInt(witness.chainID),
            payload: fromServicePayload(witness.payload),
            signature: { type: 'sapient', address: signer, data: witness.signature },
          }
        case SignatureType.SapientCompact:
          return {
            chainId: BigInt(witness.chainID),
            payload: fromServicePayload(witness.payload),
            signature: { type: 'sapient_compact', address: signer, data: witness.signature },
          }
      }
    } catch {}
  }

  async getConfigurationUpdates(
    wallet: Address.Checksummed,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
    const { updates } = await this.service.configUpdates({ wallet, fromImageHash, allUpdates: options?.allUpdates })

    return Promise.all(
      updates.map(async ({ toImageHash, signature }) => {
        Hex.assert(toImageHash)
        Hex.assert(signature)

        const decoded = Signature.decodeSignature(Hex.toBytes(signature))
        const { configuration } = await Signature.recover(decoded, wallet, 0n, Payload.fromConfigUpdate(toImageHash))

        return { imageHash: toImageHash, signature: { ...decoded, configuration } }
      }),
    )
  }

  async getTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const { version, tree } = await this.service.tree({ imageHash: rootHash })

    if (version !== 3) {
      throw new Error(`invalid tree version ${version}, expected version 3`)
    }

    return fromServiceTree(tree)
  }

  async getPayload(
    opHash: Hex.Hex,
  ): Promise<{ chainId: bigint; payload: Payload.Parented; wallet: Address.Checksummed } | undefined> {
    const { version, payload, wallet, chainID } = await this.service.payload({ digest: opHash })

    if (version !== 3) {
      throw new Error(`invalid payload version ${version}, expected version 3`)
    }

    return { payload: fromServicePayload(payload), wallet: Address.checksum(wallet), chainId: BigInt(chainID) }
  }

  async saveWallet(deployConfiguration: Config.Config, context: Context.Context): Promise<void> {
    await this.service.saveWallet({
      version: 3,
      deployConfig: getServiceConfig(deployConfiguration),
      context: {
        version: 3,
        factory: context.factory,
        mainModule: context.stage1,
        mainModuleUpgradable: context.stage2,
        guestModule: Constants.DefaultGuestAddress,
        walletCreationCode: context.creationCode,
      },
    })
  }

  async saveWitnesses(
    wallet: Address.Checksummed,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): Promise<void> {
    await this.service.saveSignerSignatures3({
      wallet,
      payload: getServicePayload(payload),
      chainID: chainId.toString(),
      signatures: getSignerSignatures(signatures).map((signature) => {
        switch (signature.type) {
          case 'hash':
            return { type: SignatureType.EIP712, signature: oxSignature.toHex(oxSignature.from(signature)) }
          case 'eth_sign':
            return { type: SignatureType.EthSign, signature: oxSignature.toHex(oxSignature.from(signature)) }
          case 'erc1271':
            return {
              type: SignatureType.EIP1271,
              signer: signature.address,
              signature: signature.data,
              referenceChainID: chainId.toString(),
            }
          case 'sapient':
            return {
              type: SignatureType.Sapient,
              signer: signature.address,
              signature: signature.data,
              referenceChainID: chainId.toString(),
            }
          case 'sapient_compact':
            return {
              type: SignatureType.SapientCompact,
              signer: signature.address,
              signature: signature.data,
              referenceChainID: chainId.toString(),
            }
        }
      }),
    })
  }

  async saveUpdate(
    wallet: Address.Checksummed,
    configuration: Config.Config,
    signature: Signature.RawSignature,
  ): Promise<void> {
    await this.service.saveSignature2({
      wallet,
      payload: getServicePayload(Payload.fromConfigUpdate(Bytes.toHex(Config.hashConfiguration(configuration)))),
      chainID: '0',
      signature: Bytes.toHex(Signature.encodeSignature(signature)),
      toConfig: getServiceConfig(configuration),
    })
  }

  async saveTree(tree: GenericTree.Tree): Promise<void> {
    await this.service.saveTree({ version: 3, tree: getServiceTree(tree) })
  }

  async saveConfiguration(config: Config.Config): Promise<void> {
    await this.service.saveConfig({ version: 3, config: getServiceConfig(config) })
  }

  async saveDeploy(_imageHash: Hex.Hex, _context: Context.Context): Promise<void> {
    // TODO: save deploy hash even if we don't have its configuration
  }

  async savePayload(wallet: Address.Checksummed, payload: Payload.Parented, chainId: bigint): Promise<void> {
    await this.service.savePayload({
      version: 3,
      payload: getServicePayload(payload),
      wallet,
      chainID: chainId.toString(),
    })
  }
}

type ServiceConfig = {
  threshold: number | string
  checkpoint: number | string
  checkpointer?: string
  tree: ServiceConfigTree
}

type ServiceConfigTree =
  | [ServiceConfigTree, ServiceConfigTree]
  | string
  | { weight: number | string; address: string; imageHash?: string }
  | { weight: number | string; threshold: number | string; tree: ServiceConfigTree }
  | { subdigest: string; isAnyAddress?: boolean }

type ServicePayload =
  | { type: 'call'; space: number | string; nonce: number | string; calls: ServicePayloadCall[] }
  | { type: 'message'; message: string }
  | { type: 'config-update'; imageHash: string }
  | { type: 'digest'; digest: string }

type ServicePayloadCall = {
  to: string
  value: number | string
  data: string
  gasLimit: number | string
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: 'ignore' | 'revert' | 'abort'
}

type ServiceTree = string | { data: string } | ServiceTree[]

function getServiceConfig(config: Config.Config): ServiceConfig {
  return {
    threshold: encodeBigInt(config.threshold),
    checkpoint: encodeBigInt(config.checkpoint),
    checkpointer: config.checkpointer,
    tree: getServiceConfigTree(config.topology),
  }
}

function fromServiceConfig(config: ServiceConfig): Config.Config {
  return {
    threshold: BigInt(config.threshold),
    checkpoint: BigInt(config.checkpoint),
    checkpointer: config.checkpointer ? Address.checksum(config.checkpointer) : undefined,
    topology: fromServiceConfigTree(config.tree),
  }
}

function getServiceConfigTree(topology: Config.Topology): ServiceConfigTree {
  if (Config.isNode(topology)) {
    return [getServiceConfigTree(topology[0]), getServiceConfigTree(topology[1])]
  } else if (Config.isSignerLeaf(topology)) {
    return { weight: encodeBigInt(topology.weight), address: topology.address }
  } else if (Config.isSapientSignerLeaf(topology)) {
    return { weight: encodeBigInt(topology.weight), address: topology.address, imageHash: topology.imageHash }
  } else if (Config.isSubdigestLeaf(topology)) {
    return { subdigest: topology.digest }
  } else if (Config.isAnyAddressSubdigestLeaf(topology)) {
    return { subdigest: topology.digest, isAnyAddress: true }
  } else if (Config.isNestedLeaf(topology)) {
    return {
      weight: encodeBigInt(topology.weight),
      threshold: encodeBigInt(topology.threshold),
      tree: getServiceConfigTree(topology.tree),
    }
  } else if (Config.isNodeLeaf(topology)) {
    return topology
  } else {
    throw new Error(`unknown topology '${JSON.stringify(topology)}'`)
  }
}

function fromServiceConfigTree(tree: ServiceConfigTree): Config.Topology {
  switch (typeof tree) {
    case 'string':
      Hex.assert(tree)
      return tree

    case 'object':
      if (tree instanceof Array) {
        return [fromServiceConfigTree(tree[0]), fromServiceConfigTree(tree[1])]
      }

      if ('weight' in tree) {
        if ('address' in tree) {
          if (tree.imageHash) {
            Hex.assert(tree.imageHash)
            return {
              type: 'sapient-signer',
              address: Address.checksum(tree.address),
              weight: BigInt(tree.weight),
              imageHash: tree.imageHash,
            }
          } else {
            return { type: 'signer', address: Address.checksum(tree.address), weight: BigInt(tree.weight) }
          }
        }

        if ('tree' in tree) {
          return {
            type: 'nested',
            weight: BigInt(tree.weight),
            threshold: BigInt(tree.threshold),
            tree: fromServiceConfigTree(tree.tree),
          }
        }
      }

      if ('subdigest' in tree) {
        Hex.assert(tree.subdigest)
        return { type: tree.isAnyAddress ? 'any-address-subdigest' : 'subdigest', digest: tree.subdigest }
      }
  }

  throw new Error(`unknown config tree '${JSON.stringify(tree)}'`)
}

function getServicePayload(payload: Payload.Payload): ServicePayload {
  if (Payload.isCalls(payload)) {
    return {
      type: 'call',
      space: encodeBigInt(payload.space),
      nonce: encodeBigInt(payload.nonce),
      calls: payload.calls.map(getServicePayloadCall),
    }
  } else if (Payload.isMessage(payload)) {
    return { type: 'message', message: payload.message }
  } else if (Payload.isConfigUpdate(payload)) {
    return { type: 'config-update', imageHash: payload.imageHash }
  } else if (Payload.isDigest(payload)) {
    return { type: 'digest', digest: payload.digest }
  } else {
    throw new Error(`unknown payload '${JSON.stringify(payload)}'`)
  }
}

function fromServicePayload(payload: ServicePayload): Payload.Payload {
  switch (payload.type) {
    case 'call':
      return {
        type: 'call',
        space: BigInt(payload.space),
        nonce: BigInt(payload.nonce),
        calls: payload.calls.map(fromServicePayloadCall),
      }

    case 'message':
      Hex.assert(payload.message)
      return { type: 'message', message: payload.message }

    case 'config-update':
      Hex.assert(payload.imageHash)
      return { type: 'config-update', imageHash: payload.imageHash }

    case 'digest':
      Hex.assert(payload.digest)
      return { type: 'digest', digest: payload.digest }
  }
}

function getServicePayloadCall(call: Payload.Call): ServicePayloadCall {
  return {
    to: call.to,
    value: encodeBigInt(call.value),
    data: call.data,
    gasLimit: encodeBigInt(call.gasLimit),
    delegateCall: call.delegateCall,
    onlyFallback: call.onlyFallback,
    behaviorOnError: call.behaviorOnError,
  }
}

function fromServicePayloadCall(call: ServicePayloadCall): Payload.Call {
  Hex.assert(call.data)

  return {
    to: Address.checksum(call.to),
    value: BigInt(call.value),
    data: call.data,
    gasLimit: BigInt(call.gasLimit),
    delegateCall: call.delegateCall,
    onlyFallback: call.onlyFallback,
    behaviorOnError: call.behaviorOnError,
  }
}

function getServiceTree(tree: GenericTree.Tree): ServiceTree {
  if (GenericTree.isBranch(tree)) {
    return tree.map(getServiceTree)
  } else if (GenericTree.isLeaf(tree)) {
    return { data: Bytes.toHex(tree.value) }
  } else if (GenericTree.isNode(tree)) {
    return tree
  } else {
    throw new Error(`unknown tree '${JSON.stringify(tree)}'`)
  }
}

function fromServiceTree(tree: ServiceTree): GenericTree.Tree {
  switch (typeof tree) {
    case 'string':
      Hex.assert(tree)
      return tree

    case 'object':
      if (tree instanceof Array) {
        return tree.map(fromServiceTree) as GenericTree.Branch
      }

      if ('data' in tree) {
        Hex.assert(tree.data)
        return { type: 'leaf', value: Hex.toBytes(tree.data) }
      }
  }

  throw new Error(`unknown tree '${JSON.stringify(tree)}'`)
}

function encodeBigInt(value: bigint): number | string {
  return value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER ? value.toString() : Number(value)
}

function getSignerSignatures(
  topology: Signature.RawTopology,
): Array<Signature.SignatureOfSignerLeaf | Signature.SignatureOfSapientSignerLeaf> {
  if (Signature.isRawNode(topology)) {
    return [...getSignerSignatures(topology[0]), ...getSignerSignatures(topology[1])]
  } else if (Signature.isRawSignerLeaf(topology)) {
    return [topology.signature]
  } else if (Config.isNestedLeaf(topology)) {
    return getSignerSignatures(topology.tree)
  } else if (Signature.isRawNestedLeaf(topology)) {
    return getSignerSignatures(topology.tree)
  } else if (Config.isSignerLeaf(topology)) {
    return topology.signature ? [topology.signature] : []
  } else if (Config.isSapientSignerLeaf(topology)) {
    return topology.signature ? [topology.signature] : []
  } else if (Config.isSubdigestLeaf(topology)) {
    return []
  } else if (Config.isAnyAddressSubdigestLeaf(topology)) {
    return []
  } else if (Config.isNodeLeaf(topology)) {
    return []
  } else {
    throw new Error(`unknown topology '${JSON.stringify(topology)}'`)
  }
}

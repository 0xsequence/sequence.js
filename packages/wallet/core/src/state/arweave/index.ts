import {
  Address as SequenceAddress,
  Config,
  Context,
  GenericTree,
  Payload,
  Signature,
} from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex, Signature as OxSignature } from 'ox'
import { Reader as ReaderInterface, normalizeAddressKeys } from '../index.js'
import { defaults, fetchItem, findItems, Options } from './arweave.js'
import type {
  ArweaveConfigRecord,
  ArweaveObject,
  ArweavePayloadRecord,
  ArweaveSapientSignatureRecord,
  ArweaveSignatureRecord,
  ArweaveTreeRecord,
  ArweaveV1ConfigUpdatePayloadRecord,
  ArweaveV2ConfigUpdatePayloadRecord,
  ArweaveV3ConfigUpdatePayloadRecord,
  ArweaveWalletRecord,
  CallData,
  ConfigData,
  SignatureType,
  TreeData,
  V1ConfigData,
  V2ConfigTreeData,
  V2ConfigData,
  V3ConfigTreeData,
  V3ConfigData,
} from './schema.js'

type ArweaveConfigUpdatePayloadRecord =
  | ArweaveV1ConfigUpdatePayloadRecord
  | ArweaveV2ConfigUpdatePayloadRecord
  | ArweaveV3ConfigUpdatePayloadRecord

type ItemTags = { [tag: string]: string }
type ItemEntry = { id: string; tags: ItemTags }

type Witness<TSignature> = {
  chainId: number
  payload: Payload.Parented
  signature: TSignature
}

type WitnessMap<TSignature> = {
  [wallet: Address.Address]: Witness<TSignature>
}

type Candidate = {
  nextImageHash: Hex.Hex
  checkpoint: bigint
  signatureEntries: Map<string, ItemEntry>
}

const PLAIN_SIGNATURE_TYPES = ['eip-712', 'eth_sign', 'erc-1271'] satisfies SignatureType[]
const SAPIENT_SIGNATURE_TYPES = ['sapient', 'sapient-compact'] satisfies SignatureType[]
const PAYLOAD_VERSION_FILTER = {
  'Major-Version': '1',
  'Minor-Version': '2',
} as const

function isPlainSignatureType(type: SignatureType): type is (typeof PLAIN_SIGNATURE_TYPES)[number] {
  return (PLAIN_SIGNATURE_TYPES as readonly SignatureType[]).includes(type)
}

function isSapientSignatureType(type: SignatureType): type is (typeof SAPIENT_SIGNATURE_TYPES)[number] {
  return (SAPIENT_SIGNATURE_TYPES as readonly SignatureType[]).includes(type)
}

function normalizeHex(value: Hex.Hex): Hex.Hex {
  return Hex.fromBytes(Hex.toBytes(value))
}

function normalizeAddress(value: Address.Address): Address.Address {
  return Address.checksum(value)
}

function signerKey(address: Address.Address): string {
  return normalizeAddress(address).toLowerCase()
}

function sapientSignerKey(address: Address.Address, imageHash: Hex.Hex): string {
  return `${signerKey(address)}:${normalizeHex(imageHash).toLowerCase()}`
}

function sameAddress(left: Address.Address | undefined, right: Address.Address | undefined): boolean {
  return left === undefined && right === undefined
    ? true
    : left !== undefined && right !== undefined && Address.isEqual(left, right)
}

function mergeConfigurations(base: Config.Config | undefined, next: Config.Config): Config.Config {
  if (!base) {
    return next
  }

  if (
    base.threshold !== next.threshold ||
    base.checkpoint !== next.checkpoint ||
    !sameAddress(base.checkpointer, next.checkpointer)
  ) {
    throw new Error('conflicting configuration metadata for the same image hash')
  }

  return {
    ...base,
    topology: Config.mergeTopology(base.topology, next.topology),
  }
}

function fromCallData(call: CallData): Payload.Call {
  return {
    to: normalizeAddress(call.to),
    value: BigInt(call.value),
    data: normalizeHex(call.data),
    gasLimit: BigInt(call.gasLimit),
    delegateCall: call.delegateCall,
    onlyFallback: call.onlyFallback,
    behaviorOnError: call.behaviorOnError,
  }
}

function fromPayloadRecord(record: ArweavePayloadRecord): Payload.Parented {
  switch (record['Payload-Type']) {
    case 'calls':
      return {
        type: 'call',
        space: BigInt(record.Space),
        nonce: BigInt(record.Nonce),
        calls: record.data.map(fromCallData),
      }

    case 'message':
      return {
        type: 'message',
        message: normalizeHex(record.data),
      }

    case 'config update':
      return {
        type: 'config-update',
        imageHash: normalizeHex(record['To-Config']),
      }

    case 'digest':
      return {
        type: 'digest',
        digest: normalizeHex(record.Digest),
      }
  }
}

function fromTreeData(tree: TreeData): GenericTree.Tree {
  if (typeof tree === 'string') {
    return normalizeHex(tree)
  }

  if (Array.isArray(tree)) {
    return tree.map(fromTreeData) as GenericTree.Branch
  }

  return {
    type: 'leaf',
    value: Bytes.fromHex(tree.data),
  }
}

function fromV2ConfigTree(tree: V2ConfigTreeData): Config.Topology {
  if (typeof tree === 'string') {
    return normalizeHex(tree)
  }

  if (Array.isArray(tree)) {
    return [fromV2ConfigTree(tree[0]), fromV2ConfigTree(tree[1])]
  }

  if ('address' in tree) {
    return {
      type: 'signer',
      address: normalizeAddress(tree.address),
      weight: BigInt(tree.weight),
    }
  }

  if ('tree' in tree) {
    return {
      type: 'nested',
      weight: BigInt(tree.weight),
      threshold: BigInt(tree.threshold),
      tree: fromV2ConfigTree(tree.tree),
    }
  }

  return {
    type: 'subdigest',
    digest: normalizeHex(tree.subdigest),
  }
}

function fromV3ConfigTree(tree: V3ConfigTreeData): Config.Topology {
  if (typeof tree === 'string') {
    return normalizeHex(tree)
  }

  if (Array.isArray(tree)) {
    return [fromV3ConfigTree(tree[0]), fromV3ConfigTree(tree[1])]
  }

  if ('address' in tree) {
    if ('imageHash' in tree) {
      return {
        type: 'sapient-signer',
        address: normalizeAddress(tree.address),
        weight: BigInt(tree.weight),
        imageHash: normalizeHex(tree.imageHash),
      }
    }

    return {
      type: 'signer',
      address: normalizeAddress(tree.address),
      weight: BigInt(tree.weight),
    }
  }

  if ('tree' in tree) {
    return {
      type: 'nested',
      weight: BigInt(tree.weight),
      threshold: BigInt(tree.threshold),
      tree: fromV3ConfigTree(tree.tree),
    }
  }

  return {
    type: 'isAnyAddress' in tree && tree.isAnyAddress ? 'any-address-subdigest' : 'subdigest',
    digest: normalizeHex(tree.subdigest),
  }
}

function fromConfigData(version: '1' | '2' | '3', data: ConfigData): Config.Config {
  switch (version) {
    case '1': {
      const v1Data = data as V1ConfigData
      if (v1Data.signers.length === 0) {
        throw new Error('legacy configuration cannot be empty')
      }

      return {
        threshold: BigInt(v1Data.threshold),
        checkpoint: 0n,
        topology: Config.flatLeavesToTopology(
          v1Data.signers.map((signer) => ({
            type: 'signer' as const,
            address: normalizeAddress(signer.address),
            weight: BigInt(signer.weight),
          })),
        ),
      }
    }

    case '2': {
      const v2Data = data as V2ConfigData
      return {
        threshold: BigInt(v2Data.threshold),
        checkpoint: BigInt(v2Data.checkpoint),
        topology: fromV2ConfigTree(v2Data.tree),
      }
    }

    case '3': {
      const v3Data = data as V3ConfigData
      return {
        threshold: BigInt(v3Data.threshold),
        checkpoint: BigInt(v3Data.checkpoint),
        checkpointer: v3Data.checkpointer ? normalizeAddress(v3Data.checkpointer) : undefined,
        topology: fromV3ConfigTree(v3Data.tree),
      }
    }
  }
}

function fromConfigCarrier(
  record:
    | ArweaveConfigRecord
    | ArweaveConfigUpdatePayloadRecord
    | Extract<ArweaveWalletRecord, { 'Deploy-Config-Attached': 'true' }>,
): Config.Config {
  switch (record.Type) {
    case 'config':
      return fromConfigData(record.Version, record.data)

    case 'payload':
      return fromConfigData(record['To-Version'], record.data)

    case 'wallet':
      return fromConfigData(record['Deploy-Version'], record.data)
  }
}

function fromSignatureRecord(record: ArweaveSignatureRecord): Signature.SignatureOfSignerLeaf {
  switch (record['Signature-Type']) {
    case 'eip-712':
      return { type: 'hash', ...OxSignature.from(record.data) }

    case 'eth_sign':
      return { type: 'eth_sign', ...OxSignature.from(record.data) }

    case 'erc-1271':
      return {
        type: 'erc1271',
        address: normalizeAddress(record.Signer),
        data: normalizeHex(record.data),
      }

    case 'sapient':
    case 'sapient-compact':
      throw new Error(`unexpected sapient signature type ${record['Signature-Type']}`)
  }
}

function fromSapientSignatureRecord(record: ArweaveSapientSignatureRecord): Signature.SignatureOfSapientSignerLeaf {
  switch (record['Signature-Type']) {
    case 'sapient':
      return {
        type: 'sapient',
        address: normalizeAddress(record.Signer),
        data: normalizeHex(record.data),
      }

    case 'sapient-compact':
      return {
        type: 'sapient_compact',
        address: normalizeAddress(record.Signer),
        data: normalizeHex(record.data),
      }

    case 'eip-712':
    case 'eth_sign':
    case 'erc-1271':
      throw new Error(`unexpected plain signature type ${record['Signature-Type']}`)
  }
}

function inferContext(record: ArweaveWalletRecord): Context.Context | undefined {
  if ('Context-Factory' in record) {
    return {
      factory: normalizeAddress(record['Context-Factory']),
      stage1: normalizeAddress(record['Context-Stage-1']),
      stage2: normalizeAddress(record['Context-Stage-2']),
      creationCode: normalizeHex(record['Context-Creation-Code']),
    }
  }

  const wallet = normalizeAddress(record.Wallet)
  const imageHashBytes = Bytes.fromHex(normalizeHex(record['Deploy-Config']))

  const knownContext = Context.KnownContexts.find((context) =>
    Address.isEqual(SequenceAddress.from(imageHashBytes, context), wallet),
  )

  if (!knownContext) {
    return undefined
  }

  return {
    factory: knownContext.factory,
    stage1: knownContext.stage1,
    stage2: knownContext.stage2,
    creationCode: knownContext.creationCode,
  }
}

function toRecoveredLikeTopology(topology: Config.Topology): Config.Topology {
  if (Config.isNode(topology)) {
    return [toRecoveredLikeTopology(topology[0]), toRecoveredLikeTopology(topology[1])]
  }

  if (Config.isSignerLeaf(topology)) {
    return topology.signature ? { ...topology, signed: true } : topology
  }

  if (Config.isSapientSignerLeaf(topology)) {
    if (topology.signature) {
      return { ...topology, signed: true }
    }

    return Hex.fromBytes(Config.hashConfiguration(topology))
  }

  if (Config.isNestedLeaf(topology)) {
    return {
      ...topology,
      tree: toRecoveredLikeTopology(topology.tree),
    }
  }

  return topology
}

function fillTopologyWithSignatures(
  configuration: Config.Config,
  signatures: Map<string, Signature.SignatureOfSignerLeaf | Signature.SignatureOfSapientSignerLeaf>,
): Config.Topology {
  return Signature.fillLeaves(configuration.topology, (leaf) => {
    if (Config.isSapientSignerLeaf(leaf)) {
      const signature = signatures.get(sapientSignerKey(leaf.address, leaf.imageHash))
      return signature && Signature.isSignatureOfSapientSignerLeaf(signature) ? signature : undefined
    }

    const signature = signatures.get(signerKey(leaf.address))
    return signature && !Signature.isSignatureOfSapientSignerLeaf(signature) ? signature : undefined
  })
}

export class Reader implements ReaderInterface {
  constructor(private readonly options: Options = defaults) {}

  private async findEntries(
    filter: { [name: string]: undefined | string | string[] },
    options?: { maxResults?: number },
  ): Promise<ItemEntry[]> {
    const items = await findItems(filter, { ...this.options, maxResults: options?.maxResults })
    return Object.entries(items).map(([id, tags]) => ({ id, tags }))
  }

  private async loadRecord<T extends ArweaveObject>(entry: ItemEntry): Promise<T> {
    const response = await fetchItem(entry.id, this.options.rateLimitRetryDelayMs, this.options.arweaveUrl)
    if (!response.ok) {
      throw new Error(`failed to fetch arweave item ${entry.id}: ${response.status}`)
    }

    const data =
      entry.tags['Content-Type'] === 'application/json' ? await response.json() : (await response.text()).trim()
    return { ...entry.tags, data } as T
  }

  private async findFirstRecord<T extends ArweaveObject>(filter: {
    [name: string]: undefined | string | string[]
  }): Promise<T | undefined> {
    const [entry] = await this.findEntries(filter, { maxResults: 1 })
    return entry ? this.loadRecord<T>(entry) : undefined
  }

  async getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    const normalizedImageHash = normalizeHex(imageHash)
    const configEntries = await this.findEntries({ Type: 'config', Config: normalizedImageHash })

    let configuration: Config.Config | undefined

    for (const record of await Promise.all(configEntries.map((entry) => this.loadRecord<ArweaveConfigRecord>(entry)))) {
      configuration = mergeConfigurations(configuration, fromConfigCarrier(record))
    }

    if (configuration) {
      return configuration
    }

    const [walletEntries, payloadEntries] = await Promise.all([
      this.findEntries({
        Type: 'wallet',
        'Deploy-Config': normalizedImageHash,
        'Deploy-Config-Attached': 'true',
      }),
      this.findEntries({
        Type: 'payload',
        ...PAYLOAD_VERSION_FILTER,
        'Payload-Type': 'config update',
        'To-Config': normalizedImageHash,
      }),
    ])

    for (const record of await Promise.all(walletEntries.map((entry) => this.loadRecord<ArweaveWalletRecord>(entry)))) {
      if (record['Deploy-Config-Attached'] === 'true') {
        configuration = mergeConfigurations(configuration, fromConfigCarrier(record))
      }
    }

    for (const record of await Promise.all(
      payloadEntries.map((entry) => this.loadRecord<ArweaveConfigUpdatePayloadRecord>(entry)),
    )) {
      configuration = mergeConfigurations(configuration, fromConfigCarrier(record))
    }

    return configuration
  }

  async getDeploy(wallet: Address.Address): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const record = await this.findFirstRecord<ArweaveWalletRecord>({
      Type: 'wallet',
      Wallet: normalizeAddress(wallet),
    })

    if (!record) {
      return undefined
    }

    const context = inferContext(record)
    if (!context) {
      return undefined
    }

    return {
      imageHash: normalizeHex(record['Deploy-Config']),
      context,
    }
  }

  private async getWalletsGeneric<TRecord extends ArweaveSignatureRecord | ArweaveSapientSignatureRecord, TSignature>(
    filter: { [name: string]: undefined | string | string[] },
    signatureFrom: (record: TRecord) => TSignature,
  ): Promise<WitnessMap<TSignature>> {
    const payloads = new Map<
      Hex.Hex,
      Promise<{ chainId: number; payload: Payload.Parented; wallet: Address.Address } | undefined>
    >()
    const response: WitnessMap<TSignature> = {}

    for (const entry of await this.findEntries(filter)) {
      const wallet = normalizeAddress(entry.tags.Wallet as Address.Address)
      if (response[wallet]) {
        continue
      }

      const record = await this.loadRecord<TRecord>(entry)
      const subdigest = normalizeHex(record.Subdigest)
      const payloadPromise = payloads.get(subdigest) ?? this.getPayload(subdigest)
      payloads.set(subdigest, payloadPromise)
      const payload = await payloadPromise

      if (!payload) {
        continue
      }

      response[wallet] = {
        chainId: payload.chainId,
        payload: payload.payload,
        signature: signatureFrom(record),
      }
    }

    return normalizeAddressKeys(response)
  }

  async getWallets(signer: Address.Address): Promise<{
    [wallet: Address.Address]: {
      chainId: number
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }> {
    return this.getWalletsGeneric<ArweaveSignatureRecord, Signature.SignatureOfSignerLeaf>(
      {
        Type: 'signature',
        Signer: normalizeAddress(signer),
        Witness: 'true',
        'Signature-Type': [...PLAIN_SIGNATURE_TYPES],
      },
      fromSignatureRecord,
    )
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
    return this.getWalletsGeneric<ArweaveSapientSignatureRecord, Signature.SignatureOfSapientSignerLeaf>(
      {
        Type: 'signature',
        Signer: normalizeAddress(signer),
        'Image-Hash': normalizeHex(imageHash),
        Witness: 'true',
        'Signature-Type': [...SAPIENT_SIGNATURE_TYPES],
      },
      fromSapientSignatureRecord,
    )
  }

  private async getWitnessGeneric<TRecord extends ArweaveSignatureRecord | ArweaveSapientSignatureRecord, TSignature>(
    filter: { [name: string]: undefined | string | string[] },
    signatureFrom: (record: TRecord) => TSignature,
  ): Promise<Witness<TSignature> | undefined> {
    const entries = await this.findEntries(filter)

    for (const entry of entries) {
      const record = await this.loadRecord<TRecord>(entry)
      const payload = await this.getPayload(record.Subdigest)
      if (!payload) {
        continue
      }

      return {
        chainId: payload.chainId,
        payload: payload.payload,
        signature: signatureFrom(record),
      }
    }
  }

  getWitnessFor(
    wallet: Address.Address,
    signer: Address.Address,
  ): Promise<{ chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined> {
    return this.getWitnessGeneric<ArweaveSignatureRecord, Signature.SignatureOfSignerLeaf>(
      {
        Type: 'signature',
        Wallet: normalizeAddress(wallet),
        Signer: normalizeAddress(signer),
        Witness: 'true',
        'Signature-Type': [...PLAIN_SIGNATURE_TYPES],
      },
      fromSignatureRecord,
    )
  }

  getWitnessForSapient(
    wallet: Address.Address,
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): Promise<
    { chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined
  > {
    return this.getWitnessGeneric<ArweaveSapientSignatureRecord, Signature.SignatureOfSapientSignerLeaf>(
      {
        Type: 'signature',
        Wallet: normalizeAddress(wallet),
        Signer: normalizeAddress(signer),
        'Image-Hash': normalizeHex(imageHash),
        Witness: 'true',
        'Signature-Type': [...SAPIENT_SIGNATURE_TYPES],
      },
      fromSapientSignatureRecord,
    )
  }

  async getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
    const normalizedWallet = normalizeAddress(wallet)
    const configuration = await this.getConfiguration(fromImageHash)
    if (!configuration) {
      return []
    }

    const { signers, sapientSigners } = Config.getSigners(configuration)
    const allowedSigners = new Set(signers.map(signerKey))
    const allowedSapientSigners = new Set(
      sapientSigners.map(({ address, imageHash }) => sapientSignerKey(address, imageHash)),
    )
    const candidates = new Map<Hex.Hex, Candidate>()

    for (const entry of await this.findEntries({ Type: 'config update', Wallet: normalizedWallet })) {
      const { tags } = entry
      const nextImageHash = normalizeHex(tags['To-Config'] as Hex.Hex)
      const checkpoint = BigInt(tags['To-Checkpoint'] as string)

      if (checkpoint <= configuration.checkpoint) {
        continue
      }

      let signatureEntryKey: string | undefined
      if (isPlainSignatureType(tags['Signature-Type'] as SignatureType)) {
        const key = signerKey(tags.Signer as Address.Address)
        if (allowedSigners.has(key)) {
          signatureEntryKey = key
        }
      } else if (isSapientSignatureType(tags['Signature-Type'] as SignatureType) && 'Image-Hash' in tags) {
        const key = sapientSignerKey(tags.Signer as Address.Address, tags['Image-Hash'] as Hex.Hex)
        if (allowedSapientSigners.has(key)) {
          signatureEntryKey = key
        }
      }

      if (!signatureEntryKey) {
        continue
      }

      const candidate = candidates.get(nextImageHash) ?? {
        nextImageHash,
        checkpoint,
        signatureEntries: new Map<string, ItemEntry>(),
      }

      if (!candidate.signatureEntries.has(signatureEntryKey)) {
        candidate.signatureEntries.set(signatureEntryKey, entry)
      }

      candidates.set(nextImageHash, candidate)
    }

    let best:
      | {
          nextImageHash: Hex.Hex
          checkpoint: bigint
          signature: Signature.RawSignature
        }
      | undefined

    const sortedCandidates = Array.from(candidates.values()).sort((left, right) => {
      if (left.checkpoint === right.checkpoint) {
        return 0
      }

      return left.checkpoint > right.checkpoint ? (options?.allUpdates ? 1 : -1) : options?.allUpdates ? -1 : 1
    })

    for (const candidate of sortedCandidates) {
      if (best && candidate.checkpoint <= best.checkpoint) {
        continue
      }

      const signatures = new Map<string, Signature.SignatureOfSignerLeaf | Signature.SignatureOfSapientSignerLeaf>()
      let topology = configuration.topology

      for (const entry of candidate.signatureEntries.values()) {
        if (isSapientSignatureType(entry.tags['Signature-Type'] as SignatureType)) {
          const record = await this.loadRecord<ArweaveSapientSignatureRecord>(entry)
          signatures.set(sapientSignerKey(record.Signer, record['Image-Hash']), fromSapientSignatureRecord(record))
        } else {
          const record = await this.loadRecord<ArweaveSignatureRecord>(entry)
          signatures.set(signerKey(record.Signer), fromSignatureRecord(record))
        }

        topology = fillTopologyWithSignatures(configuration, signatures)
        const { weight } = Config.getWeight(topology, () => false)
        if (weight >= configuration.threshold) {
          break
        }
      }

      const { weight } = Config.getWeight(topology, () => false)
      if (weight < configuration.threshold) {
        continue
      }

      best = {
        nextImageHash: candidate.nextImageHash,
        checkpoint: candidate.checkpoint,
        signature: {
          noChainId: true,
          configuration: {
            threshold: configuration.threshold,
            checkpoint: configuration.checkpoint,
            checkpointer: configuration.checkpointer,
            topology: toRecoveredLikeTopology(topology),
          },
        },
      }

      if (options?.allUpdates) {
        break
      }
    }

    if (!best) {
      return []
    }

    const nextStep = await this.getConfigurationUpdates(normalizedWallet, best.nextImageHash, { allUpdates: true })
    return [{ imageHash: best.nextImageHash, signature: best.signature }, ...nextStep]
  }

  async getTree(imageHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const record = await this.findFirstRecord<ArweaveTreeRecord>({
      Type: 'tree',
      Tree: normalizeHex(imageHash),
    })

    return record ? fromTreeData(record.data) : undefined
  }

  async getPayload(
    digest: Hex.Hex,
  ): Promise<{ chainId: number; payload: Payload.Parented; wallet: Address.Address } | undefined> {
    const record = await this.findFirstRecord<ArweavePayloadRecord>({
      Type: 'payload',
      ...PAYLOAD_VERSION_FILTER,
      Payload: normalizeHex(digest),
    })

    if (!record) {
      return undefined
    }

    return {
      chainId: Number(record['Chain-ID']),
      payload: fromPayloadRecord(record),
      wallet: normalizeAddress(record.Address),
    }
  }
}

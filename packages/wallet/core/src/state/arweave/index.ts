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
  noChainId: boolean
  signatureEntries: Map<string, ItemEntry>
}

type TopologyChoice = {
  topology: Config.Topology
  weight: bigint
  signatures: number
  size: number
  signatureMask: string
}

type TopologyChoiceSet = {
  slotCount: number
  choices: Map<string, TopologyChoice>
}

const PLAIN_SIGNATURE_TYPES = ['eip-712', 'eth_sign', 'erc-1271'] satisfies SignatureType[]
const SAPIENT_SIGNATURE_TYPES = ['sapient', 'sapient-compact'] satisfies SignatureType[]
const PAYLOAD_VERSION_FILTER = {
  'Major-Version': '1',
  'Minor-Version': '2',
} as const

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

function clampWeight(weight: bigint, cap: bigint): bigint {
  return weight > cap ? cap : weight
}

function zeroMask(length: number): string {
  return '0'.repeat(length)
}

function compareChoices(left: TopologyChoice, right: TopologyChoice): number {
  if (left.signatures !== right.signatures) {
    return left.signatures - right.signatures
  }

  if (left.size !== right.size) {
    return left.size - right.size
  }

  if (left.signatureMask !== right.signatureMask) {
    return left.signatureMask > right.signatureMask ? -1 : 1
  }

  return 0
}

function dominatesChoice(left: TopologyChoice, right: TopologyChoice): boolean {
  return (
    left.weight >= right.weight &&
    left.signatures <= right.signatures &&
    left.size <= right.size &&
    left.signatureMask >= right.signatureMask
  )
}

function makeChoice(
  topology: Config.Topology,
  weight: bigint,
  signatures: number,
  signatureMask: string,
): TopologyChoice {
  return {
    topology,
    weight,
    signatures,
    size: Signature.encodeTopology(topology).length,
    signatureMask,
  }
}

function addChoice(choiceSet: TopologyChoiceSet, choice: TopologyChoice): void {
  const key = choice.weight.toString()
  const existing = choiceSet.choices.get(key)

  if (!existing || compareChoices(choice, existing) < 0) {
    choiceSet.choices.set(key, choice)
  }
}

function pruneChoiceSet(choiceSet: TopologyChoiceSet): TopologyChoiceSet {
  const choices = [...choiceSet.choices.values()]
  const pruned = new Map<string, TopologyChoice>()

  for (const candidate of choices) {
    const dominated = choices.some((other) => other !== candidate && dominatesChoice(other, candidate))
    if (!dominated) {
      pruned.set(candidate.weight.toString(), candidate)
    }
  }

  return { ...choiceSet, choices: pruned }
}

function buildTopologyChoiceSet(topology: Config.Topology, cap: bigint): TopologyChoiceSet {
  if (Signature.isSignedSignerLeaf(topology)) {
    const choices: TopologyChoiceSet = { slotCount: 1, choices: new Map() }
    addChoice(
      choices,
      makeChoice({ type: 'signer', address: topology.address, weight: topology.weight }, 0n, 0, '0'),
    )

    if (topology.weight > 0n) {
      addChoice(choices, makeChoice(topology, clampWeight(topology.weight, cap), 1, '1'))
    }

    return choices
  }

  if (Signature.isSignedSapientSignerLeaf(topology)) {
    const choices: TopologyChoiceSet = { slotCount: 1, choices: new Map() }
    addChoice(choices, makeChoice(Hex.fromBytes(Config.hashConfiguration(topology)), 0n, 0, '0'))

    if (topology.weight > 0n) {
      addChoice(choices, makeChoice(topology, clampWeight(topology.weight, cap), 1, '1'))
    }

    return choices
  }

  if (Config.isSignerLeaf(topology)) {
    return {
      slotCount: 0,
      choices: new Map([[0n.toString(), makeChoice(topology, 0n, 0, '')]]),
    }
  }

  if (Config.isSapientSignerLeaf(topology)) {
    return {
      slotCount: 0,
      choices: new Map([[0n.toString(), makeChoice(Hex.fromBytes(Config.hashConfiguration(topology)), 0n, 0, '')]]),
    }
  }

  if (Config.isSubdigestLeaf(topology) || Config.isAnyAddressSubdigestLeaf(topology) || Config.isNodeLeaf(topology)) {
    return {
      slotCount: 0,
      choices: new Map([[0n.toString(), makeChoice(topology, 0n, 0, '')]]),
    }
  }

  if (Config.isNestedLeaf(topology)) {
    const treeChoices = buildTopologyChoiceSet(topology.tree, topology.threshold)
    const choices: TopologyChoiceSet = { slotCount: treeChoices.slotCount, choices: new Map() }
    addChoice(choices, makeChoice(Hex.fromBytes(Config.hashConfiguration(topology)), 0n, 0, zeroMask(treeChoices.slotCount)))

    const satisfied = treeChoices.choices.get(topology.threshold.toString())
    if (satisfied && topology.weight > 0n) {
      addChoice(
        choices,
        makeChoice(
          { ...topology, tree: satisfied.topology },
          clampWeight(topology.weight, cap),
          satisfied.signatures,
          satisfied.signatureMask,
        ),
      )
    }

    return pruneChoiceSet(choices)
  }

  const leftChoices = buildTopologyChoiceSet(topology[0], cap)
  const rightChoices = buildTopologyChoiceSet(topology[1], cap)
  const choices: TopologyChoiceSet = {
    slotCount: leftChoices.slotCount + rightChoices.slotCount,
    choices: new Map(),
  }

  addChoice(choices, makeChoice(Hex.fromBytes(Config.hashConfiguration(topology)), 0n, 0, zeroMask(choices.slotCount)))

  for (const leftChoice of leftChoices.choices.values()) {
    for (const rightChoice of rightChoices.choices.values()) {
      addChoice(
        choices,
        makeChoice(
          [leftChoice.topology, rightChoice.topology],
          clampWeight(leftChoice.weight + rightChoice.weight, cap),
          leftChoice.signatures + rightChoice.signatures,
          `${leftChoice.signatureMask}${rightChoice.signatureMask}`,
        ),
      )
    }
  }

  return pruneChoiceSet(choices)
}

function minimizeTopologyForThreshold(topology: Config.Topology, threshold: bigint): Config.Topology | undefined {
  return buildTopologyChoiceSet(topology, threshold).choices.get(threshold.toString())?.topology
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
    const signatureRecords = new Map<string, Promise<ArweaveSignatureRecord | ArweaveSapientSignatureRecord>>()
    const loadSignatureRecord = (entry: ItemEntry): Promise<ArweaveSignatureRecord | ArweaveSapientSignatureRecord> => {
      const cached = signatureRecords.get(entry.id)
      if (cached) {
        return cached
      }

      const promise = isSapientSignatureType(entry.tags['Signature-Type'] as SignatureType)
        ? this.loadRecord<ArweaveSapientSignatureRecord>(entry)
        : this.loadRecord<ArweaveSignatureRecord>(entry)

      signatureRecords.set(entry.id, promise)
      return promise
    }

    const updates: Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }> = []
    let currentImageHash = normalizeHex(fromImageHash)

    top: while (true) {
      const currentConfig = await this.getConfiguration(currentImageHash)
      if (!currentConfig) {
        return updates
      }

      const { signers, sapientSigners } = Config.getSigners(currentConfig)
      const [plainEntries, sapientEntries] = await Promise.all([
        signers.length
          ? this.findEntries({
              Type: 'config update',
              Wallet: normalizedWallet,
              Signer: signers.map(normalizeAddress),
              'Signature-Type': [...PLAIN_SIGNATURE_TYPES],
            })
          : Promise.resolve([]),
        Promise.all(
          sapientSigners.map(({ address, imageHash }) =>
            this.findEntries({
              Type: 'config update',
              Wallet: normalizedWallet,
              Signer: normalizeAddress(address),
              'Image-Hash': normalizeHex(imageHash),
              'Signature-Type': [...SAPIENT_SIGNATURE_TYPES],
            }),
          ),
        ),
      ])

      const candidates = new Map<string, Candidate>()
      const addCandidate = (entry: ItemEntry, key: string) => {
        const checkpoint = BigInt(entry.tags['To-Checkpoint']!)
        if (checkpoint <= currentConfig.checkpoint) {
          return
        }

        const nextImageHash = normalizeHex(entry.tags['To-Config'] as Hex.Hex)
        const candidateKey = `${checkpoint}:${nextImageHash.toLowerCase()}`
        const candidate = candidates.get(candidateKey)

        if (candidate) {
          if (!candidate.signatureEntries.has(key)) {
            candidate.signatureEntries.set(key, entry)
          }

          return
        }

        candidates.set(candidateKey, {
          nextImageHash,
          checkpoint,
          noChainId: entry.tags['Major-Version'] !== '1',
          signatureEntries: new Map([[key, entry]]),
        })
      }

      for (const entry of plainEntries) {
        addCandidate(entry, signerKey(entry.tags.Signer as Address.Address))
      }

      for (const entries of sapientEntries) {
        for (const entry of entries) {
          addCandidate(
            entry,
            sapientSignerKey(entry.tags.Signer as Address.Address, entry.tags['Image-Hash'] as Hex.Hex),
          )
        }
      }

      const sortedCandidates = [...candidates.values()].sort((left, right) => {
        if (left.checkpoint === right.checkpoint) {
          return 0
        }

        if (options?.allUpdates) {
          return left.checkpoint < right.checkpoint ? -1 : 1
        }

        return left.checkpoint > right.checkpoint ? -1 : 1
      })

      for (const candidate of sortedCandidates) {
        const signatures = new Map<string, Signature.SignatureOfSignerLeaf | Signature.SignatureOfSapientSignerLeaf>()
        const records = await Promise.all([...candidate.signatureEntries.values()].map(loadSignatureRecord))

        for (const record of records) {
          if (isSapientSignatureType(record['Signature-Type'])) {
            const sapientRecord = record as ArweaveSapientSignatureRecord
            signatures.set(
              sapientSignerKey(sapientRecord.Signer, sapientRecord['Image-Hash']),
              fromSapientSignatureRecord(sapientRecord),
            )
          } else {
            signatures.set(signerKey(record.Signer), fromSignatureRecord(record as ArweaveSignatureRecord))
          }
        }

        const filledTopology = fillTopologyWithSignatures(currentConfig, signatures)
        const minimalTopology = minimizeTopologyForThreshold(filledTopology, currentConfig.threshold)
        if (!minimalTopology) {
          continue
        }

        const topology = toRecoveredLikeTopology(minimalTopology)
        const { weight } = Config.getWeight(topology, () => false)
        if (weight < currentConfig.threshold) {
          continue
        }

        updates.push({
          imageHash: candidate.nextImageHash,
          signature: {
            noChainId: candidate.noChainId,
            configuration: {
              threshold: currentConfig.threshold,
              checkpoint: currentConfig.checkpoint,
              checkpointer: currentConfig.checkpointer,
              topology,
            },
          },
        })

        currentImageHash = candidate.nextImageHash
        continue top
      }

      return updates
    }
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

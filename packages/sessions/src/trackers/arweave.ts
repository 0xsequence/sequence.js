import { commons, universal, v2 } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'
import { CachedEIP5719 } from '@0xsequence/replacer'
import { ethers } from 'ethers'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'

// depending on @0xsequence/abi breaks 0xsequence's proxy-transport-channel integration test
const MAIN_MODULE_ABI = [
  'function execute((bool delegateCall, bool revertOnError, uint256 gasLimit, address target, uint256 value, bytes data)[] calldata transactions, uint256 nonce, bytes calldata signature)'
]

export interface Options {
  readonly namespace?: string
  readonly owners?: string[]
  readonly arweaveUrl?: string
  readonly graphqlUrl?: string
  readonly eip5719Provider?: ethers.Provider
  readonly rateLimitRetryDelayMs?: number
  // When a signer published several signatures for the same payload (e.g. a guard wallet after a key rotation),
  // the newest one that validates is used. Signatures are checked on the chain they were made for: this returns the
  // provider for that chain. No-chain-id signatures are checked on the chain returned for chain id 0, which the caller
  // picks. Without a provider for a chain, signatures on it can't be checked and the newest one is used.
  readonly validationProviders?: (chainId: bigint) => ethers.Provider | undefined
}

export const defaults = {
  namespace: 'Sequence-Sessions',
  owners: ['AZ6R2mG8zxW9q7--iZXGrBknjegHoPzmG5IG-nxvMaM'],
  arweaveUrl: 'https://arweave.net',
  graphqlUrl: 'https://arweave.net/graphql',
  eip5719Provider: undefined,
  rateLimitRetryDelayMs: 5 * 60 * 1000
}

/**
 * Groups config update items (newest first, as returned by the query) by target config and signer.
 * The newest signature of each signer is kept, so a signer that publishes a replacement (e.g. a guard wallet after a
 * key rotation) is not shadowed by its older, no longer valid signature.
 */
export function groupConfigUpdateItems<T extends { toImageHash: string; signer: string }>(
  items: T[]
): { signatures: Map<string, Map<string, T[]>>; candidates: T[] } {
  const signatures: Map<string, Map<string, T[]>> = new Map()
  const candidates: T[] = []

  for (const item of items) {
    let imageHashSignatures = signatures.get(item.toImageHash)
    if (!imageHashSignatures) {
      imageHashSignatures = new Map()
      signatures.set(item.toImageHash, imageHashSignatures)
      candidates.push(item)
    }
    const signerItems = imageHashSignatures.get(item.signer)
    if (signerItems) {
      signerItems.push(item)
    } else {
      imageHashSignatures.set(item.signer, [item])
    }
  }

  return { signatures, candidates }
}

/**
 * Result of checking a signature on-chain: true (valid), false (invalid), or undefined when it can't be checked
 * (no provider, signer without code, RPC error).
 */
export type Validity = boolean | undefined

/**
 * Picks a signature among entries ordered newest first:
 * - the newest entry that validates;
 * - otherwise the newest entry that could not be checked (it may be valid, the ones checked are not);
 * - otherwise (every entry checked and invalid, or no validator) the newest entry.
 * Entries whose signature can't be loaded are skipped.
 */
export async function pickSignature<E>(
  entries: E[],
  load: (entry: E) => Promise<string>,
  check?: (entry: E, signature: string) => Validity | Promise<Validity>
): Promise<{ entry: E; signature: string } | undefined> {
  let newest: { entry: E; signature: string } | undefined
  let newestUnchecked: { entry: E; signature: string } | undefined

  for (const entry of entries) {
    let signature: string
    try {
      signature = await load(entry)
    } catch (error) {
      console.warn('unable to load signature:', error)
      continue
    }

    if (newest === undefined) {
      newest = { entry, signature }
    }
    if (!check) {
      return newest
    }

    let validity: Validity
    try {
      validity = await check(entry, signature)
    } catch {
      validity = undefined
    }

    if (validity === true) {
      return { entry, signature }
    }
    if (validity === undefined && newestUnchecked === undefined) {
      newestUnchecked = { entry, signature }
    }
  }

  if (newestUnchecked) {
    return newestUnchecked
  }
  if (newest && check) {
    console.warn('no signature validates, using the newest one')
  }
  return newest
}

/**
 * Checks a signature of `signer` for `digest` on `provider`'s chain. Contract signers are checked with ERC-1271,
 * which hashes `digest` with their own domain; a signer without code can't be checked.
 */
export async function checkSignature(
  provider: ethers.Provider | undefined,
  signer: string,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike,
  dynamic: boolean
): Promise<Validity> {
  if (!dynamic) {
    try {
      return ethers.getAddress(commons.signer.recoverSigner(digest, signature)) === ethers.getAddress(signer)
    } catch {
      return false
    }
  }

  if (!provider) {
    return undefined
  }
  try {
    if ((await provider.getCode(signer)) === '0x') {
      return undefined
    }
    return await commons.EIP1271.isValidEIP1271Signature(signer, ethers.hexlify(digest), signature, provider)
  } catch {
    return undefined
  }
}

export class ArweaveReader implements ConfigTracker, migrator.PresignedMigrationTracker {
  private readonly configs: Map<string, Promise<commons.config.Config | undefined>> = new Map()
  private readonly eip5719?: CachedEIP5719

  constructor(readonly options: Options = defaults) {
    if (options.eip5719Provider) {
      this.eip5719 = new CachedEIP5719(options.eip5719Provider)
    }
  }

  async loadPresignedConfiguration(args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean
  }): Promise<PresignedConfigLink[]> {
    const wallet = ethers.getAddress(args.wallet)

    const fromConfig = await this.configOfImageHash({ imageHash: args.fromImageHash })
    if (!fromConfig) {
      throw new Error(`unable to find from config ${args.fromImageHash}`)
    }
    if (!v2.config.isWalletConfig(fromConfig)) {
      throw new Error(`from config ${args.fromImageHash} is not v2`)
    }
    const fromCheckpoint = BigInt(fromConfig.checkpoint)

    const items = Object.entries(await findItems({ Type: 'config update', Wallet: wallet }, this.options)).flatMap(
      ([id, tags]) => {
        try {
          const { Signer: signer, Subdigest: subdigest, Digest: digest, 'To-Config': toImageHash } = tags

          let signatureType: 'eip-712' | 'eth_sign' | 'erc-1271'
          switch (tags['Signature-Type']) {
            case 'eip-712':
            case 'eth_sign':
            case 'erc-1271':
              signatureType = tags['Signature-Type']
              break
            default:
              throw new Error(`unknown signature type ${tags['Signature-Type']}`)
          }

          let toCheckpoint: bigint
          try {
            toCheckpoint = BigInt(tags['To-Checkpoint'])
          } catch {
            throw new Error(`to checkpoint is not a number: ${tags['To-Checkpoint']}`)
          }
          if (toCheckpoint <= fromCheckpoint) {
            return []
          }

          if (!ethers.isAddress(signer)) {
            throw new Error(`signer is not an address: ${signer}`)
          }

          if (!ethers.isHexString(subdigest, 32)) {
            throw new Error(`subdigest is not a hash: ${subdigest}`)
          }

          if (!ethers.isHexString(digest, 32)) {
            throw new Error(`digest is not a hash: ${digest}`)
          }

          let chainId: bigint
          try {
            chainId = BigInt(tags['Chain-ID'])
          } catch {
            throw new Error(`chain id is not a number: ${tags['Chain-ID']}`)
          }

          if (!ethers.isHexString(toImageHash, 32)) {
            throw new Error(`to config is not a hash: ${toImageHash}`)
          }

          return [{ id, signatureType, signer, subdigest, digest, chainId, toImageHash, toCheckpoint }]
        } catch (error) {
          console.warn(`invalid wallet ${wallet} config update ${id}:`, error)
          return []
        }
      }
    )

    const grouped = groupConfigUpdateItems(items)
    const signatures = grouped.signatures
    let candidates = grouped.candidates

    if (args.longestPath) {
      candidates.sort(({ toCheckpoint: a }, { toCheckpoint: b }) => (a === b ? 0 : a < b ? -1 : 1))
    } else {
      candidates.sort(({ toCheckpoint: a }, { toCheckpoint: b }) => (a === b ? 0 : a < b ? 1 : -1))
    }

    const updates: PresignedConfigLink[] = []

    for (let currentConfig = fromConfig; candidates.length; ) {
      const currentImageHash = v2.config.imageHash(currentConfig)

      let nextCandidate: (typeof candidates)[number] | undefined
      let nextCandidateItems: Map<string, Array<(typeof items)[number]>>
      let nextCandidateSigners: string[] = []

      for (const candidate of candidates) {
        nextCandidateItems = signatures.get(candidate.toImageHash)!
        nextCandidateSigners = Array.from(nextCandidateItems.keys())

        const { weight } = v2.signature.encodeSigners(
          currentConfig,
          new Map(nextCandidateSigners.map(signer => [signer, { signature: '0x', isDynamic: false }])),
          [],
          0
        )

        if (weight >= BigInt(currentConfig.threshold)) {
          nextCandidate = candidate
          break
        }
      }

      if (!nextCandidate) {
        console.warn(`unreachable configs with checkpoint > ${currentConfig.checkpoint} from config ${currentImageHash}`)
        break
      }

      const nextImageHash = nextCandidate.toImageHash

      try {
        const nextConfig = await this.configOfImageHash({ imageHash: nextImageHash })
        if (!nextConfig) {
          throw new Error(`unable to find config ${nextImageHash}`)
        }
        if (!v2.config.isWalletConfig(nextConfig)) {
          throw new Error(`config ${nextImageHash} is not v2`)
        }

        const nextCandidateSignatures = new Map(
          (
            await Promise.all(
              nextCandidateSigners.map(async signer => {
                const picked = await pickSignature(
                  nextCandidateItems.get(signer)!,
                  entry => this.loadConfigUpdateSignature(entry),
                  this.options.validationProviders
                    ? (entry, signature) => {
                        const bytes = ethers.getBytes(signature)
                        const dynamic = bytes[bytes.length - 1] === commons.signer.SigType.WALLET_BYTES32
                        return checkSignature(
                          this.options.validationProviders!(entry.chainId),
                          signer,
                          entry.subdigest,
                          dynamic ? bytes.slice(0, -1) : bytes,
                          dynamic
                        )
                      }
                    : undefined
                )
                if (!picked) {
                  return []
                }
                const { signature } = picked
                const recovered = commons.signer.tryRecoverSigner(picked.entry.subdigest, signature)
                return [[signer, { signature, isDynamic: recovered !== signer }] as const]
              })
            )
          ).flat()
        )

        const { encoded: signature, weight } = v2.signature.encodeSigners(currentConfig, nextCandidateSignatures, [], 0)
        if (weight < BigInt(currentConfig.threshold)) {
          throw new Error(`insufficient signing power ${weight.toString()} < ${currentConfig.threshold}`)
        }
        updates.push({ wallet, signature, nextImageHash })

        currentConfig = nextConfig
        candidates = candidates.filter(({ toCheckpoint }) => toCheckpoint > BigInt(currentConfig.checkpoint))
      } catch (error) {
        console.warn(
          `unable to reconstruct wallet ${wallet} update from config ${currentImageHash} to config ${nextImageHash}:`,
          error
        )
        candidates = candidates.filter(({ toImageHash }) => toImageHash !== nextImageHash)
      }
    }

    return updates
  }

  savePresignedConfiguration(_args: PresignedConfig): Promise<void> {
    throw new Error('arweave backend does not support saving config updates')
  }

  saveWitnesses(_args: { wallet: string; digest: string; chainId: ethers.BigNumberish; signatures: string[] }): Promise<void> {
    throw new Error('arweave backend does not support saving signatures')
  }

  async configOfImageHash(args: { imageHash: string; noCache?: boolean }): Promise<commons.config.Config | undefined> {
    if (!args.noCache) {
      const config = this.configs.get(args.imageHash)
      if (config) {
        try {
          return await config
        } catch {
          const config = this.configs.get(args.imageHash)
          if (config) {
            return config
          }
        }
      }
    }

    const config = (async (imageHash: string): Promise<commons.config.Config | undefined> => {
      const items = Object.entries(await findItems({ Type: 'config', Config: imageHash }, this.options)).flatMap(([id, tags]) => {
        try {
          const version = Number(tags.Version)
          if (!version) {
            throw new Error(`invalid version: ${tags.Version}`)
          }

          return [{ id, version }]
        } catch (error) {
          console.warn(`config ${imageHash} at ${id} invalid:`, error)
          return []
        }
      })

      switch (items.length) {
        case 0:
          this.configs.set(imageHash, Promise.resolve(undefined))
          return
        case 1:
          break
        default:
          console.warn(`multiple configs ${imageHash} at ${items.map(({ id }) => id).join(', ')}`)
          break
      }

      for (const { id, version } of items) {
        try {
          const config = {
            ...(await (await fetchItem(id, this.options.rateLimitRetryDelayMs, this.options.arweaveUrl)).json()),
            version
          }
          if (config.tree) {
            config.tree = toTopology(config.tree)
          }

          const actual = universal.coderFor(version).config.imageHashOf(config)
          if (actual !== imageHash) {
            throw new Error(`image hash is ${actual}, expected ${imageHash}`)
          }

          this.configs.set(imageHash, Promise.resolve(config))
          return config
        } catch (error) {
          console.warn(`config at ${id} invalid:`, error)
        }
      }

      this.configs.set(imageHash, Promise.resolve(undefined))
      return
    })(args.imageHash)

    if (!args.noCache) {
      this.configs.set(args.imageHash, config)
    }

    return config
  }

  saveWalletConfig(_args: { config: commons.config.Config }): Promise<void> {
    throw new Error('arweave backend does not support saving configs')
  }

  async imageHashOfCounterfactualWallet(args: {
    wallet: string
    noCache?: boolean
  }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    const wallet = ethers.getAddress(args.wallet)

    const items = Object.entries(await findItems({ Type: 'wallet', Wallet: wallet }, this.options)).flatMap(([id, tags]) => {
      try {
        const { 'Deploy-Config': imageHash } = tags

        const version = Number(tags['Deploy-Version'])
        if (!version) {
          throw new Error(`invalid version: ${tags['Deploy-Version']}`)
        }

        if (!imageHash) {
          throw new Error('no deploy config')
        }

        const context = commons.context.defaultContexts[version]
        if (!context) {
          throw new Error(`unknown version: ${version}`)
        }

        if (commons.context.addressOf(context, imageHash) !== wallet) {
          throw new Error(`incorrect v${version} deploy config: ${imageHash}`)
        }

        return [{ id, imageHash, context }]
      } catch (error) {
        console.warn(`wallet ${wallet} at ${id} invalid:`, error)
        return []
      }
    })

    switch (items.length) {
      case 0:
        return
      case 1:
        break
      default:
        console.warn(`multiple deploy configs for wallet ${wallet} at ${items.map(({ id }) => id).join(', ')}, using first`)
        break
    }

    return items[0]
  }

  saveCounterfactualWallet(_args: { config: commons.config.Config; context: commons.context.WalletContext[] }): Promise<void> {
    throw new Error('arweave backend does not support saving wallets')
  }

  async walletsOfSigner(args: {
    signer: string
    noCache?: boolean
    allSignatures?: boolean
  }): Promise<Array<{ wallet: string; proof: { digest: string; chainId: bigint; signature: string } }>> {
    const signer = ethers.getAddress(args.signer)

    const proofs: Map<string, { digest: string; chainId: bigint; signature: Promise<string> }> = new Map()

    for (const [id, tags] of Object.entries(
      await findItems(
        { Type: ['signature', 'config update'], Signer: signer, Witness: args.allSignatures ? undefined : 'true' },
        this.options
      )
    )) {
      const { Wallet: wallet, Subdigest: subdigest, Digest: digest, 'Chain-ID': chainId } = tags

      try {
        if (proofs.has(wallet)) {
          continue
        }

        let signatureType: '01' | '02' | '03'
        switch (tags['Signature-Type']) {
          case 'eip-712':
            signatureType = '01'
            break
          case 'eth_sign':
            signatureType = '02'
            break
          case 'erc-1271':
            signatureType = '03'
            break
          default:
            throw new Error(`unknown signature type ${tags['Signature-Type']}`)
        }

        if (subdigest !== commons.signature.subdigestOf({ digest, chainId, address: wallet })) {
          throw new Error('incorrect subdigest')
        }

        const signature = fetchItem(id, this.options.rateLimitRetryDelayMs, this.options.arweaveUrl).then(async response => {
          const signature = (await response.text()) + signatureType
          if (this.eip5719) {
            try {
              return ethers.hexlify(await this.eip5719.runByEIP5719(signer, subdigest, signature))
            } catch (error) {
              console.warn(`unable to run eip-5719 on signature ${id}`)
            }
          }
          return signature
        })

        proofs.set(wallet, { digest, chainId: BigInt(chainId), signature })
      } catch (error) {
        console.warn(`signer ${signer} signature ${id} of wallet ${wallet} invalid:`, error)
      }
    }

    return Promise.all(
      [...proofs.entries()].map(async ([wallet, { digest, chainId, signature }]) => ({
        wallet,
        proof: { digest, chainId, signature: await signature }
      }))
    )
  }

  private async loadConfigUpdateSignature(entry: {
    id: string
    signer: string
    subdigest: string
    signatureType: 'eip-712' | 'eth_sign' | 'erc-1271'
  }): Promise<string> {
    let signature = await (await fetchItem(entry.id, this.options.rateLimitRetryDelayMs, this.options.arweaveUrl)).text()
    switch (entry.signatureType) {
      case 'eip-712':
        signature += '01'
        break
      case 'eth_sign':
        signature += '02'
        break
      case 'erc-1271':
        signature += '03'
        break
    }
    if (this.eip5719) {
      try {
        signature = ethers.hexlify(await this.eip5719.runByEIP5719(entry.signer, entry.subdigest, signature))
      } catch (error) {
        console.warn(`unable to run eip-5719 on config update ${entry.id}`)
      }
    }
    return signature
  }

  async getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    const wallet = ethers.getAddress(address)

    const items = Object.entries(
      await findItems(
        {
          Type: 'migration',
          Migration: wallet,
          'Chain-ID': BigInt(chainId).toString(),
          'From-Version': `${fromVersion}`,
          'From-Config': fromImageHash
        },
        this.options
      )
    ).flatMap(([id, tags]) => {
      try {
        const { 'To-Config': toImageHash, Executor: executor } = tags

        const toVersion = Number(tags['To-Version'])
        if (!toVersion) {
          throw new Error(`invalid version: ${tags['To-Version']}`)
        }

        if (!ethers.isHexString(toImageHash, 32)) {
          throw new Error(`to config is not a hash: ${toImageHash}`)
        }

        if (!ethers.isAddress(executor)) {
          throw new Error(`executor is not an address: ${executor}`)
        }

        return { id, toVersion, toImageHash, executor }
      } catch (error) {
        console.warn(
          `chain ${chainId} migration ${id} for v${fromVersion} wallet ${wallet} from config ${fromImageHash} invalid:`,
          error
        )
        return []
      }
    })

    switch (items.length) {
      case 0:
        return
      case 1:
        break
      default:
        console.warn(
          `multiple chain ${chainId} migrations for v${fromVersion} wallet ${wallet} from config ${fromImageHash} at ${items.map(({ id }) => id).join(', ')}, using the newest valid one`
        )
        break
    }

    const mainModule = new ethers.Interface(MAIN_MODULE_ABI)
    const decode = (data: string) => {
      const [encoded, nonce, signature] = mainModule.decodeFunctionData('execute', data)
      const transactions = commons.transaction.fromTxAbiEncode(encoded)
      const subdigest = commons.transaction.subdigestOfTransactions(wallet, chainId, nonce, transactions)
      return { transactions, nonce, signature: signature as string, subdigest }
    }

    // Newest first: use the newest migration whose signature validates on its chain. The wallet's ERC-1271 check
    // takes the transactions digest and applies its own domain (chain id, wallet address).
    const validationProvider = this.options.validationProviders?.(BigInt(chainId))
    const picked = await pickSignature(
      items,
      item => fetchItem(item.id, this.options.rateLimitRetryDelayMs, this.options.arweaveUrl).then(response => response.text()),
      this.options.validationProviders
        ? async (_item, data) => {
            const { transactions, nonce, signature } = decode(data)
            const digest = commons.transaction.digestOfTransactions(nonce, transactions)
            return checkSignature(validationProvider, wallet, digest, signature, true)
          }
        : undefined
    )
    if (!picked) {
      throw new Error(`unable to load chain ${chainId} migration for v${fromVersion} wallet ${wallet}`)
    }

    const { toVersion, toImageHash, executor } = picked.entry
    const toConfig = await this.configOfImageHash({ imageHash: toImageHash })

    if (!toConfig) {
      throw new Error(`unable to find to config ${toImageHash} for migration`)
    }

    const { transactions, nonce, signature, subdigest } = decode(picked.signature)

    return {
      tx: { entrypoint: executor, transactions, nonce, chainId, intent: { id: subdigest, wallet }, signature },
      fromVersion,
      toVersion: Number(toVersion),
      toConfig
    }
  }

  saveMigration(_address: string, _signed: migrator.SignedMigration, _contexts: commons.context.VersionedContext): Promise<void> {
    throw new Error('arweave backend does not support saving migrations')
  }
}

async function findItems(
  filter: { [name: string]: undefined | string | string[] },
  options?: Options & { pageSize?: number; maxResults?: number }
): Promise<{ [id: string]: { [tag: string]: string } }> {
  const namespace = options?.namespace ?? defaults.namespace
  const owners = options?.owners
  const graphqlUrl = options?.graphqlUrl ?? defaults.graphqlUrl
  const rateLimitRetryDelayMs = options?.rateLimitRetryDelayMs ?? defaults.rateLimitRetryDelayMs
  const pageSize = options?.pageSize ?? 100
  const maxResults = options?.maxResults

  const tags = Object.entries(filter).flatMap(([name, values]) =>
    values === undefined
      ? []
      : [
          `{ name: "${namespace ? `${namespace}-${name}` : name}", values: [${typeof values === 'string' ? `"${values}"` : values.map(value => `"${value}"`).join(', ')}] }`
        ]
  )

  const edges: Array<{ cursor: string; node: { id: string; tags: Array<{ name: string; value: string }> } }> = []

  for (let hasNextPage = true; hasNextPage && (maxResults === undefined || edges.length < maxResults); ) {
    const query = `
      query {
        transactions(sort: HEIGHT_DESC, ${edges.length ? `first: ${pageSize}, after: "${edges[edges.length - 1].cursor}"` : `first: ${pageSize}`}, tags: [${tags.join(', ')}]${owners === undefined ? '' : `, owners: [${owners.map(owner => `"${owner}"`).join(', ')}]`}) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `

    let response: Response
    while (true) {
      response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        redirect: 'follow'
      })
      if (response.status !== 429) {
        break
      }
      console.warn(
        `rate limited by ${graphqlUrl}, trying again in ${rateLimitRetryDelayMs / 1000} seconds at ${new Date(Date.now() + rateLimitRetryDelayMs).toLocaleTimeString()}`
      )
      await new Promise(resolve => setTimeout(resolve, rateLimitRetryDelayMs))
    }

    if (!response.ok) {
      throw new Error(`${graphqlUrl} returned ${response.status} ${response.statusText}`)
    }

    const {
      data: { transactions }
    } = await response.json()

    edges.push(...transactions.edges)

    hasNextPage = transactions.pageInfo.hasNextPage
  }

  return Object.fromEntries(
    edges.map(({ node: { id, tags } }) => [
      id,
      Object.fromEntries(
        tags.map(({ name, value }) => [
          namespace && name.startsWith(`${namespace}-`) ? name.slice(namespace.length + 1) : name,
          value
        ])
      )
    ])
  )
}

async function fetchItem(
  id: string,
  rateLimitRetryDelayMs = defaults.rateLimitRetryDelayMs,
  arweaveUrl = defaults.arweaveUrl
): Promise<Response> {
  while (true) {
    const response = await fetch(`${arweaveUrl}/${id}`, { redirect: 'follow' })
    if (response.status !== 429) {
      return response
    }
    console.warn(
      `rate limited by ${arweaveUrl}, trying again in ${rateLimitRetryDelayMs / 1000} seconds at ${new Date(Date.now() + rateLimitRetryDelayMs).toLocaleTimeString()}`
    )
    await new Promise(resolve => setTimeout(resolve, rateLimitRetryDelayMs))
  }
}

function toTopology(topology: any): v2.config.Topology {
  if (typeof topology === 'string') {
    return { nodeHash: topology }
  }

  if (typeof topology === 'object' && topology?.node !== undefined) {
    return { nodeHash: topology.node }
  }

  if (topology instanceof Array && topology.length === 2) {
    return { left: toTopology(topology[0]), right: toTopology(topology[1]) }
  }

  if (v2.config.isNode(topology)) {
    return { left: toTopology(topology.left), right: toTopology(topology.right) }
  }

  if (v2.config.isNestedLeaf(topology)) {
    return { ...topology, tree: toTopology(topology.tree) }
  }

  return topology
}

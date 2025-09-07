import { walletContracts } from '@0xsequence/abi'
import { commons, universal } from '@0xsequence/core'
import { migrator, defaults, version } from '@0xsequence/migration'
import { ChainId, NetworkConfig } from '@0xsequence/network'
import { type FeeOption, type FeeQuote, isRelayer, type Relayer, RpcRelayer } from '@0xsequence/relayer'
import type { tracker } from '@0xsequence/sessions'
import type { SignatureOrchestrator } from '@0xsequence/signhub'
import { encodeTypedDataDigest, getFetchRequest } from '@0xsequence/utils'
import { Wallet } from '@0xsequence/wallet'
import { ethers, MessagePrefix } from 'ethers'
import { AccountSigner, AccountSignerOptions } from './signer'

export type AccountStatus = {
  original: {
    version: number
    imageHash: string
    context: commons.context.WalletContext
  }
  onChain: {
    imageHash: string
    config: commons.config.Config
    version: number
    deployed: boolean
  }
  fullyMigrated: boolean
  signedMigrations: migrator.SignedMigration[]
  version: number
  presignedConfigurations: tracker.PresignedConfigLink[]
  imageHash: string
  config: commons.config.Config
  checkpoint: ethers.BigNumberish
  canOnchainValidate: boolean
}

export type AccountOptions = {
  // The only unique identifier for a wallet is the address
  address: string

  // The config tracker keeps track of chained configs,
  // counterfactual addresses and reverse lookups for configurations
  // it must implement both the ConfigTracker and MigrationTracker
  tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker

  // Versioned contexts contains the context information for each Sequence version
  contexts: commons.context.VersionedContext

  // Optional list of migrations, if not provided, the default migrations will be used
  // NOTICE: the last vestion is considered the "current" version for the account
  migrations?: migrator.Migrations

  // Orchestrator manages signing messages and transactions
  orchestrator: SignatureOrchestrator

  // Networks information and providers
  networks: NetworkConfig[]

  // Jwt
  jwt?: string

  // Project access key
  projectAccessKey?: string
}

export interface PreparedTransactions {
  transactions: commons.transaction.SimulatedTransaction[]
  flatDecorated: commons.transaction.Transaction[]
  feeOptions: FeeOption[]
  feeQuote?: FeeQuote
}

class Chain0Reader implements commons.reader.Reader {
  async isDeployed(_wallet: string): Promise<boolean> {
    return false
  }

  async implementation(_wallet: string): Promise<string | undefined> {
    return undefined
  }

  async imageHash(_wallet: string): Promise<string | undefined> {
    return undefined
  }

  async nonce(_wallet: string, _space: ethers.BigNumberish): Promise<bigint> {
    return 0n
  }

  async isValidSignature(_wallet: string, _digest: ethers.BytesLike, _signature: ethers.BytesLike): Promise<boolean> {
    throw new Error('Method not supported.')
  }
}

export class Account {
  public readonly address: string

  public readonly networks: NetworkConfig[]
  public readonly tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  public readonly contexts: commons.context.VersionedContext

  public readonly migrator: migrator.Migrator
  public readonly migrations: migrator.Migrations

  private orchestrator: SignatureOrchestrator

  private jwt?: string

  private projectAccessKey?: string

  constructor(options: AccountOptions) {
    this.address = ethers.getAddress(options.address)

    this.contexts = options.contexts
    this.tracker = options.tracker
    this.networks = options.networks
    this.orchestrator = options.orchestrator
    this.jwt = options.jwt
    this.projectAccessKey = options.projectAccessKey

    this.migrations = options.migrations || defaults.DefaultMigrations
    this.migrator = new migrator.Migrator(options.tracker, this.migrations, this.contexts)
  }

  getSigner(chainId: ChainId, options?: AccountSignerOptions): AccountSigner {
    return new AccountSigner(this, chainId, options)
  }

  static async new(options: {
    config: commons.config.SimpleConfig
    tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
    contexts: commons.context.VersionedContext
    orchestrator: SignatureOrchestrator
    networks: NetworkConfig[]
    migrations?: migrator.Migrations
    projectAccessKey?: string
  }): Promise<Account> {
    const mig = new migrator.Migrator(options.tracker, options.migrations ?? defaults.DefaultMigrations, options.contexts)

    const lastMigration = mig.lastMigration()
    const lastCoder = lastMigration.configCoder

    const config = lastCoder.fromSimple(options.config)
    const imageHash = lastCoder.imageHashOf(config)
    const context = options.contexts[lastMigration.version]
    const address = commons.context.addressOf(context, imageHash)

    await options.tracker.saveCounterfactualWallet({ config, context: Object.values(options.contexts) })

    return new Account({
      address,
      tracker: options.tracker,
      contexts: options.contexts,
      networks: options.networks,
      orchestrator: options.orchestrator,
      migrations: options.migrations,
      projectAccessKey: options.projectAccessKey
    })
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.address)
  }

  get version(): number {
    return this.migrator.lastMigration().version
  }

  get coders(): {
    signature: commons.signature.SignatureCoder
    config: commons.config.ConfigCoder
  } {
    const lastMigration = this.migrator.lastMigration()

    return {
      signature: lastMigration.signatureCoder,
      config: lastMigration.configCoder
    }
  }

  network(chainId: ethers.BigNumberish): NetworkConfig {
    const tcid = BigInt(chainId)
    const found = this.networks.find(n => tcid === BigInt(n.chainId))
    if (!found) throw new Error(`Network not found for chainId ${chainId}`)
    return found
  }

  providerFor(chainId: ethers.BigNumberish): ethers.Provider {
    const found = this.network(chainId)
    if (!found.provider && !found.rpcUrl) {
      throw new Error(`Provider not found for chainId ${chainId}`)
    }

    const network = new ethers.Network(found.name, found.chainId)

    return (
      found.provider ||
      new ethers.JsonRpcProvider(getFetchRequest(found.rpcUrl, this.projectAccessKey, this.jwt), network, {
        staticNetwork: network
      })
    )
  }

  reader(chainId: ethers.BigNumberish): commons.reader.Reader {
    if (BigInt(chainId) === 0n) {
      return new Chain0Reader()
    }

    // TODO: Networks should be able to provide a reader directly
    // and we should default to the on-chain reader
    return new commons.reader.OnChainReader(this.providerFor(chainId))
  }

  relayer(chainId: ethers.BigNumberish): Relayer {
    const found = this.network(chainId)
    if (!found.relayer) throw new Error(`Relayer not found for chainId ${chainId}`)
    if (isRelayer(found.relayer)) return found.relayer
    return new RpcRelayer({
      ...found.relayer,
      // we pass both projectAccessKey and jwtAuth because the projectAccessKey is
      // used either for unauthenticated access, or gas sponsorship even if the jwtAuth is provided,
      ...{ projectAccessKey: this.projectAccessKey, jwtAuth: this.jwt }
    })
  }

  setOrchestrator(orchestrator: SignatureOrchestrator) {
    this.orchestrator = orchestrator
  }

  setJwt(jwt: string) {
    this.jwt = jwt
  }

  contextFor(version: number): commons.context.WalletContext {
    const ctx = this.contexts[version]
    if (!ctx) throw new Error(`Context not found for version ${version}`)
    return ctx
  }

  walletForStatus(chainId: ethers.BigNumberish, status: Pick<AccountStatus, 'version'> & Pick<AccountStatus, 'config'>): Wallet {
    const coder = universal.coderFor(status.version)
    return this.walletFor(chainId, this.contextFor(status.version), status.config, coder)
  }

  walletFor(
    chainId: ethers.BigNumberish,
    context: commons.context.WalletContext,
    config: commons.config.Config,
    coders: typeof this.coders
  ): Wallet {
    const isNetworkZero = BigInt(chainId) === 0n
    return new Wallet({
      config,
      context,
      chainId,
      coders,
      relayer: isNetworkZero ? undefined : this.relayer(chainId),
      address: this.address,
      orchestrator: this.orchestrator,
      reader: this.reader(chainId)
    })
  }

  // Get the status of the account on a given network
  // this does the following process:
  // 1. Get the current on-chain status of the wallet (version + imageHash)
  // 2. Get any pending migrations that have been signed by the wallet
  // 3. Get any pending configuration updates that have been signed by the wallet
  // 4. Fetch reverse lookups for both on-chain and pending configurations
  async status(chainId: ethers.BigNumberish, longestPath: boolean = false): Promise<AccountStatus> {
    const isDeployedPromise = this.reader(chainId).isDeployed(this.address)

    const counterfactualImageHashPromise = this.tracker
      .imageHashOfCounterfactualWallet({
        wallet: this.address
      })
      .then(r => {
        if (!r) throw new Error(`Counterfactual imageHash not found for wallet ${this.address}`)
        return r
      })

    const counterFactualVersionPromise = counterfactualImageHashPromise.then(r => {
      return version.counterfactualVersion(this.address, r.imageHash, Object.values(this.contexts))
    })

    const onChainVersionPromise = (async () => {
      const isDeployed = await isDeployedPromise
      if (!isDeployed) return counterFactualVersionPromise

      const implementation = await this.reader(chainId).implementation(this.address)
      if (!implementation) throw new Error(`Implementation not found for wallet ${this.address}`)

      const versions = Object.values(this.contexts)
      for (let i = 0; i < versions.length; i++) {
        if (versions[i].mainModule === implementation || versions[i].mainModuleUpgradable === implementation) {
          return versions[i].version
        }
      }

      throw new Error(`Version not found for implementation ${implementation}`)
    })()

    const onChainImageHashPromise = (async () => {
      const deployedImageHash = await this.reader(chainId).imageHash(this.address)
      if (deployedImageHash) return deployedImageHash
      const counterfactualImageHash = await counterfactualImageHashPromise
      if (counterfactualImageHash) return counterfactualImageHash.imageHash
      throw new Error(`On-chain imageHash not found for wallet ${this.address}`)
    })()

    const onChainConfigPromise = (async () => {
      const onChainImageHash = await onChainImageHashPromise
      const onChainConfig = await this.tracker.configOfImageHash({ imageHash: onChainImageHash })
      if (onChainConfig) return onChainConfig
      throw new Error(`On-chain config not found for imageHash ${onChainImageHash}`)
    })()

    const onChainVersion = await onChainVersionPromise
    const onChainImageHash = await onChainImageHashPromise

    let fromImageHash = onChainImageHash
    let lastVersion = onChainVersion
    let signedMigrations: migrator.SignedMigration[] = []

    if (onChainVersion !== this.version) {
      // We either need to use the presigned configuration updates, or we haven't performed
      // any updates yet, so we can only use the on-chain imageHash as-is
      const presignedMigrate = await this.migrator.getAllMigratePresignedTransaction({
        address: this.address,
        fromImageHash: onChainImageHash,
        fromVersion: onChainVersion,
        chainId
      })

      // The migrator returns the original version and imageHash
      // if no presigned migration is found, so no need to check here
      fromImageHash = presignedMigrate.lastImageHash
      lastVersion = presignedMigrate.lastVersion

      signedMigrations = presignedMigrate.signedMigrations
    }

    const presigned = await this.tracker.loadPresignedConfiguration({
      wallet: this.address,
      fromImageHash: fromImageHash,
      longestPath
    })

    const imageHash = presigned && presigned.length > 0 ? presigned[presigned.length - 1].nextImageHash : fromImageHash
    const config = await this.tracker.configOfImageHash({ imageHash })
    if (!config) {
      throw new Error(`Config not found for imageHash ${imageHash}`)
    }

    const isDeployed = await isDeployedPromise
    const counterfactualImageHash = await counterfactualImageHashPromise
    const checkpoint = universal.coderFor(lastVersion).config.checkpointOf(config as any)

    return {
      original: {
        ...counterfactualImageHash,
        version: await counterFactualVersionPromise
      },
      onChain: {
        imageHash: onChainImageHash,
        config: await onChainConfigPromise,
        version: onChainVersion,
        deployed: isDeployed
      },
      fullyMigrated: lastVersion === this.version,
      signedMigrations,
      version: lastVersion,
      presignedConfigurations: presigned,
      imageHash,
      config,
      checkpoint,
      canOnchainValidate: onChainVersion === this.version && isDeployed
    }
  }

  private mustBeFullyMigrated(status: AccountStatus) {
    if (!status.fullyMigrated) {
      throw new Error(`Wallet ${this.address} is not fully migrated`)
    }
  }

  async predecorateSignedTransactions(
    status: AccountStatus,
    chainId: ethers.BigNumberish
  ): Promise<commons.transaction.SignedTransactionBundle[]> {
    // Request signed predecorate transactions from child wallets
    const bundles = await this.orchestrator.predecorateSignedTransactions({ chainId })
    // Get signed predecorate transaction
    const predecorated = await this.predecorateTransactions([], status, chainId)
    if (commons.transaction.fromTransactionish(this.address, predecorated).length > 0) {
      // Sign it
      bundles.push(await this.signTransactions(predecorated, chainId))
    }
    return bundles
  }

  async predecorateTransactions(
    txs: commons.transaction.Transactionish,
    status: AccountStatus,
    chainId: ethers.BigNumberish
  ): Promise<commons.transaction.Transactionish> {
    txs = Array.isArray(txs) ? txs : [txs]
    // if onchain wallet config is not up to date
    // then we should append an extra transaction that updates it
    // to the latest "lazy" state
    if (status.onChain.imageHash !== status.imageHash) {
      const wallet = this.walletForStatus(chainId, status)
      const updateConfig = await wallet.buildUpdateConfigurationTransaction(status.config)
      txs = [...txs, ...updateConfig.transactions]
    }

    // On immutable chains, we add the WalletProxyHook
    const { proxyImplementationHook } = this.contexts[status.config.version]
    if (proxyImplementationHook && (chainId === ChainId.IMMUTABLE_ZKEVM || chainId === ChainId.IMMUTABLE_ZKEVM_TESTNET)) {
      const provider = this.providerFor(chainId)
      if (provider) {
        const hook = new ethers.Contract(this.address, walletContracts.walletProxyHook.abi, provider)
        let implementation
        try {
          implementation = await hook.PROXY_getImplementation()
        } catch (e) {
          // Handle below
          console.log('Error getting implementation address', e)
        }
        if (!implementation || implementation === ethers.ZeroAddress) {
          console.log('Adding wallet proxy hook')
          const hooksInterface = new ethers.Interface(walletContracts.moduleHooks.abi)
          const tx: commons.transaction.Transaction = {
            to: this.address,
            data: hooksInterface.encodeFunctionData(hooksInterface.getFunction('addHook')!, [
              '0x90611127',
              proxyImplementationHook
            ]),
            gasLimit: 50000, // Expected ~28k gas. Buffer added
            delegateCall: false,
            revertOnError: false,
            value: 0
          }
          txs = [tx, ...txs]
        }
      }
    }

    return txs
  }

  async decorateTransactions(
    bundles: commons.transaction.IntendedTransactionBundle | commons.transaction.IntendedTransactionBundle[],
    status: AccountStatus,
    chainId?: ethers.BigNumberish
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    if (!Array.isArray(bundles)) {
      // Recurse with array
      return this.decorateTransactions([bundles], status, chainId)
    }

    // Default to chainId of first bundle when not supplied
    chainId = chainId ?? bundles[0].chainId

    const bootstrapBundle = await this.buildBootstrapTransactions(status, chainId)
    const hasBootstrapTxs = bootstrapBundle.transactions.length > 0

    if (!hasBootstrapTxs && bundles.length === 1) {
      return bundles[0]
    }

    // Intent defaults to first bundle when no bootstrap transaction
    const { entrypoint } = hasBootstrapTxs ? bootstrapBundle : bundles[0]

    const decoratedBundle = {
      entrypoint,
      chainId,
      // Intent of the first bundle is used
      intent: bundles[0]?.intent,
      transactions: [
        ...bootstrapBundle.transactions,
        ...bundles.map(
          (bundle): commons.transaction.Transaction => ({
            to: bundle.entrypoint,
            data: commons.transaction.encodeBundleExecData(bundle),
            gasLimit: 0,
            delegateCall: false,
            revertOnError: true,
            value: 0
          })
        )
      ]
    }

    // Re-compute the meta-transaction id to use the guest module subdigest
    if (!status.onChain.deployed) {
      const id = commons.transaction.subdigestOfGuestModuleTransactions(
        this.contexts[this.version].guestModule,
        chainId,
        decoratedBundle.transactions
      )

      if (decoratedBundle.intent === undefined) {
        decoratedBundle.intent = { id, wallet: this.address }
      } else {
        decoratedBundle.intent.id = id
      }
    }

    return decoratedBundle
  }

  async decorateSignature<T extends ethers.BytesLike>(
    signature: T,
    status: Partial<Pick<AccountStatus, 'presignedConfigurations'>>
  ): Promise<T | string> {
    if (!status.presignedConfigurations || status.presignedConfigurations.length === 0) {
      return signature
    }

    const coder = this.coders.signature

    const chain = status.presignedConfigurations.map(c => c.signature)
    const chainedSignature = coder.chainSignatures(signature, chain)
    return coder.trim(chainedSignature)
  }

  async publishWitnessFor(signers: string[], chainId: ethers.BigNumberish = 0): Promise<void> {
    const digest = ethers.id(`This is a Sequence account woo! ${Date.now()}`)

    const status = await this.status(chainId)
    const allOfAll = this.coders.config.fromSimple({
      threshold: signers.length,
      checkpoint: 0,
      signers: signers.map(s => ({
        address: s,
        weight: 1
      }))
    })

    const wallet = this.walletFor(chainId, status.original.context, allOfAll, this.coders)
    const signature = await wallet.signDigest(digest)

    const decoded = this.coders.signature.decode(signature)
    const signatures = this.coders.signature.signaturesOfDecoded(decoded)

    if (signatures.length === 0) {
      throw new Error('No signatures found')
    }

    return this.tracker.saveWitnesses({ wallet: this.address, digest, chainId, signatures })
  }

  async publishWitness(): Promise<void> {
    const digest = ethers.id(`This is a Sequence account woo! ${Date.now()}`)
    const signature = await this.signDigest(digest, 0, false)
    const decoded = this.coders.signature.decode(signature)
    const signatures = this.coders.signature.signaturesOfDecoded(decoded)
    return this.tracker.saveWitnesses({ wallet: this.address, digest, chainId: 0, signatures })
  }

  async signDigest(
    digest: ethers.BytesLike,
    chainId: ethers.BigNumberish,
    decorate: boolean = true,
    cantValidateBehavior: 'ignore' | 'eip6492' | 'throw' = 'ignore',
    metadata?: object
  ): Promise<string> {
    // If we are signing a digest for chainId zero then we can never be fully migrated
    // because Sequence v1 doesn't allow for signing a message on "all chains"

    // So we ignore the state on "chain zero" and instead use one of the states of the networks
    // wallet-webapp should ensure the wallet is as migrated as possible, trying to mimic
    // the behaviour of being migrated on all chains
    const chainRef = BigInt(chainId) === 0n ? this.networks[0].chainId : chainId
    const status = await this.status(chainRef)
    this.mustBeFullyMigrated(status)

    // Check if we can validate onchain and what to do if we can't
    // revert early, since there is no point in signing a digest now
    if (!status.canOnchainValidate && cantValidateBehavior === 'throw') {
      throw new Error('Wallet cannot validate onchain')
    }

    const wallet = this.walletForStatus(chainId, status)
    const signature = await wallet.signDigest(digest, metadata)

    const decorated = decorate ? this.decorateSignature(signature, status) : signature

    // If the wallet can't validate onchain then we
    // need to prefix the decorated signature with all deployments and migrations
    // aka doing a bootstrap using EIP-6492
    if (!status.canOnchainValidate) {
      switch (cantValidateBehavior) {
        // NOTICE: We covered this case before signing the digest
        // case 'throw':
        //   throw new Error('Wallet cannot validate on-chain')
        case 'ignore':
          return decorated

        case 'eip6492':
          return this.buildEIP6492Signature(await decorated, status, chainId)
      }
    }

    return decorated
  }

  buildOnChainSignature(digest: ethers.BytesLike): { bundle: commons.transaction.TransactionBundle; signature: string } {
    const subdigest = commons.signature.subdigestOf({
      digest: ethers.hexlify(digest),
      chainId: 0,
      address: this.address
    })
    const hexSubdigest = ethers.hexlify(subdigest)
    const config = this.coders.config.fromSimple({
      // Threshold *only* needs to be > 0, this is not a magic number
      // we only use 2 ** 15 because it may lead to lower gas costs in some chains
      threshold: 32768,
      checkpoint: 0,
      signers: [],
      subdigests: [hexSubdigest]
    })

    const walletInterface = new ethers.Interface(walletContracts.mainModule.abi)
    const bundle: commons.transaction.TransactionBundle = {
      entrypoint: this.address,
      transactions: [
        {
          to: this.address,
          data: walletInterface.encodeFunctionData(
            // *NEVER* use updateImageHash here, as it would effectively destroy the wallet
            // setExtraImageHash sets an additional imageHash, without changing the current one
            'setExtraImageHash',
            [
              this.coders.config.imageHashOf(config),
              // 2 ** 255 instead of max uint256, to have more zeros in the calldata
              '57896044618658097711785492504343953926634992332820282019728792003956564819968'
            ]
          ),
          // Conservative gas limit, used because the current relayer
          // has trouble estimating gas for this transaction
          gasLimit: 250000
        }
      ]
    }

    // Fire and forget request to save the config
    this.tracker.saveWalletConfig({ config })

    // Encode a signature proof for the given subdigest
    // use `chainId = 0` to make it simpler, as this signature is only a proof
    const signature = this.coders.signature.encodeSigners(config, new Map(), [hexSubdigest], 0).encoded
    return { bundle, signature }
  }

  private async buildEIP6492Signature(signature: string, status: AccountStatus, chainId: ethers.BigNumberish): Promise<string> {
    const bootstrapBundle = await this.buildBootstrapTransactions(status, chainId)
    if (bootstrapBundle.transactions.length === 0) {
      throw new Error('Cannot build EIP-6492 signature without bootstrap transactions')
    }

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes', 'bytes'],
      [bootstrapBundle.entrypoint, commons.transaction.encodeBundleExecData(bootstrapBundle), signature]
    )

    return ethers.solidityPacked(['bytes', 'bytes32'], [encoded, commons.EIP6492.EIP_6492_SUFFIX])
  }

  async editConfig(changes: {
    add?: commons.config.SimpleSigner[]
    remove?: string[]
    threshold?: ethers.BigNumberish
  }): Promise<void> {
    const currentConfig = await this.status(0).then(s => s.config)
    const newConfig = this.coders.config.editConfig(currentConfig, {
      ...changes,
      checkpoint: this.coders.config.checkpointOf(currentConfig) + 1n
    })

    return this.updateConfig(newConfig)
  }

  async updateConfig(config: commons.config.Config): Promise<void> {
    // config should be for the current version of the wallet
    if (!this.coders.config.isWalletConfig(config)) {
      throw new Error(`Invalid config for wallet ${this.address}`)
    }

    const nextImageHash = this.coders.config.imageHashOf(config)

    // sign an update config struct
    const updateStruct = this.coders.signature.hashSetImageHash(nextImageHash)

    // sign the update struct, using chain id 0
    const signature = await this.signDigest(updateStruct, 0, false)

    // save the presigned transaction to the sessions tracker
    await this.tracker.savePresignedConfiguration({
      wallet: this.address,
      nextConfig: config,
      signature,
      referenceChainId: 1
    })

    // safety check, tracker should have a reverse lookup for the imageHash
    // outside of the local cache
    const reverseConfig = await this.tracker.configOfImageHash({
      imageHash: nextImageHash,
      noCache: true
    })

    if (!reverseConfig || this.coders.config.imageHashOf(reverseConfig) !== nextImageHash) {
      throw Error(`Reverse lookup failed for imageHash ${nextImageHash}`)
    }
  }

  /**
   *  This method is used to bootstrap the wallet on a given chain.
   *  this deploys the wallets and executes all the necessary transactions
   *  for that wallet to start working with the given version.
   *
   *  This usually involves: (a) deploying the wallet, (b) executing migrations
   *
   *  Notice: It should NOT explicitly include chained signatures. Unless internally used
   *  by any of the migrations.
   *
   */
  async buildBootstrapTransactions(
    status: AccountStatus,
    chainId: ethers.BigNumberish
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    const bundle = await this.orchestrator.buildDeployTransaction({ chainId })
    const transactions: commons.transaction.Transaction[] = bundle?.transactions ?? []

    // Add wallet deployment if needed
    if (!status.onChain.deployed) {
      let gasLimit: bigint | undefined
      switch (BigInt(chainId)) {
        case BigInt(ChainId.SKALE_NEBULA):
          gasLimit = 10000000n
          break
        case BigInt(ChainId.SOMNIA_TESTNET):
          gasLimit = 10000000n
          break
        case BigInt(ChainId.SOMNIA):
          gasLimit = 10000000n
          break
      }

      // Wallet deployment will vary depending on the version
      // so we need to use the context to get the correct deployment
      const deployTransaction = Wallet.buildDeployTransaction(status.original.context, status.original.imageHash, gasLimit)

      transactions.push(...deployTransaction.transactions)
    }

    // Get pending migrations
    transactions.push(
      ...status.signedMigrations.map(m => ({
        to: m.tx.entrypoint,
        data: commons.transaction.encodeBundleExecData(m.tx),
        value: 0,
        gasLimit: 0,
        revertOnError: true,
        delegateCall: false
      }))
    )

    // Build the transaction intent, if the transaction has migrations
    // then we should use one of the intents of the migrations (anyone will do)
    // if it doesn't, then the only intent we could use if the GuestModule one
    // ... but this may fail if the relayer uses a different GuestModule
    const id =
      status.signedMigrations.length > 0
        ? status.signedMigrations[0].tx.intent.id
        : commons.transaction.subdigestOfGuestModuleTransactions(this.contexts[this.version].guestModule, chainId, transactions)

    // Everything is encoded as a bundle
    // using the GuestModule of the account version
    const { guestModule } = this.contextFor(status.version)
    return { entrypoint: guestModule, transactions, chainId, intent: { id, wallet: this.address } }
  }

  async bootstrapTransactions(
    chainId: ethers.BigNumberish,
    prestatus?: AccountStatus
  ): Promise<Omit<commons.transaction.IntendedTransactionBundle, 'chainId'>> {
    const status = prestatus || (await this.status(chainId))
    return this.buildBootstrapTransactions(status, chainId)
  }

  async doBootstrap(chainId: ethers.BigNumberish, feeQuote?: FeeQuote, prestatus?: AccountStatus) {
    const bootstrapTxs = await this.bootstrapTransactions(chainId, prestatus)
    return this.relayer(chainId).relay({ ...bootstrapTxs, chainId }, feeQuote)
  }

  /**
   * Signs a message.
   *
   * This method will sign the message using the account associated with this signer
   * and the specified chain ID. If the message is already prefixed with the EIP-191
   * prefix, it will be hashed directly. Otherwise, it will be prefixed before hashing.
   *
   * @param message - The message to sign. Can be a string or BytesLike.
   * @param chainId - The chain ID to use for signing
   * @param cantValidateBehavior - Behavior when the wallet cannot validate on-chain
   * @returns A Promise that resolves to the signature as a hexadecimal string
   */
  signMessage(
    message: ethers.BytesLike,
    chainId: ethers.BigNumberish,
    cantValidateBehavior: 'ignore' | 'eip6492' | 'throw' = 'ignore'
  ): Promise<string> {
    const messageHex = ethers.hexlify(message)
    const prefixHex = ethers.hexlify(ethers.toUtf8Bytes(MessagePrefix))

    let digest: string

    // We check if the message is already prefixed with EIP-191
    // This will avoid breaking changes for codebases where the message is already prefixed
    if (messageHex.substring(2).startsWith(prefixHex.substring(2))) {
      digest = ethers.keccak256(message)
    } else {
      digest = ethers.hashMessage(message)
    }

    return this.signDigest(digest, chainId, true, cantValidateBehavior)
  }

  async signTransactions(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    pstatus?: AccountStatus,
    options?: {
      nonceSpace?: ethers.BigNumberish
      serial?: boolean
    }
  ): Promise<commons.transaction.SignedTransactionBundle> {
    const status = pstatus || (await this.status(chainId))
    this.mustBeFullyMigrated(status)

    const wallet = this.walletForStatus(chainId, status)

    const metadata: commons.WalletSignRequestMetadata = {
      address: this.address,
      digest: '', // Set in wallet.signTransactions
      chainId,
      config: { version: this.version },
      decorate: true,
      cantValidateBehavior: 'ignore'
    }

    const nonceOptions = options?.serial
      ? { serial: true }
      : options?.nonceSpace !== undefined
        ? { space: options.nonceSpace }
        : undefined

    const signed = await wallet.signTransactions(txs, nonceOptions, metadata)

    return {
      ...signed,
      signature: await this.decorateSignature(signed.signature, status)
    }
  }

  async signMigrations(
    chainId: ethers.BigNumberish,
    editConfig: (prevConfig: commons.config.Config) => commons.config.Config
  ): Promise<boolean> {
    const status = await this.status(chainId)
    if (status.fullyMigrated) return false

    const wallet = this.walletForStatus(chainId, status)
    const nextConfig = editConfig(wallet.config)
    const signed = await this.migrator.signNextMigration(this.address, status.version, wallet, nextConfig)
    if (!signed) return false

    // Make sure the tracker has a copy of the config
    // before attempting to save the migration
    // otherwise if this second step fails the tracker could end up
    // with a migration to an unknown config
    await this.tracker.saveWalletConfig({ config: nextConfig })
    const nextCoder = universal.coderFor(nextConfig.version).config
    const nextImageHash = nextCoder.imageHashOf(nextConfig as any)
    const reverseConfig = await this.tracker.configOfImageHash({ imageHash: nextImageHash, noCache: true })
    if (!reverseConfig || nextCoder.imageHashOf(reverseConfig as any) !== nextImageHash) {
      throw Error(`Reverse lookup failed for imageHash ${nextImageHash}`)
    }

    await this.tracker.saveMigration(this.address, signed, this.contexts)

    return true
  }

  async signAllMigrations(
    editConfig: (prevConfig: commons.config.Config) => commons.config.Config
  ): Promise<{ signedMigrations: Array<any>; failedChains: number[] }> {
    const failedChains: number[] = []
    const signedMigrations = await Promise.all(
      this.networks.map(async n => {
        try {
          // Signing migrations for each chain
          return await this.signMigrations(n.chainId, editConfig)
        } catch (error) {
          console.warn(`Failed to sign migrations for chain ${n.chainId}`, error)

          // Adding failed chainId to the failedChains array
          failedChains.push(n.chainId)
          // Using null as a placeholder for failed chains
          return null
        }
      })
    )

    // Filter out null values to get only the successful signed migrations
    const successfulSignedMigrations = signedMigrations.filter(migration => migration !== null)

    return { signedMigrations: successfulSignedMigrations, failedChains }
  }

  async isMigratedAllChains(): Promise<{ migratedAllChains: boolean; failedChains: number[] }> {
    const failedChains: number[] = []
    const statuses = await Promise.all(
      this.networks.map(async n => {
        try {
          return await this.status(n.chainId)
        } catch (error) {
          failedChains.push(n.chainId)

          console.warn(`Failed to get status for chain ${n.chainId}`, error)

          // default to true for failed chains
          return { fullyMigrated: true }
        }
      })
    )

    const migratedAllChains = statuses.every(s => s.fullyMigrated)
    return { migratedAllChains, failedChains }
  }

  async sendSignedTransactions(
    signedBundle: commons.transaction.IntendedTransactionBundle | commons.transaction.IntendedTransactionBundle[],
    chainId: ethers.BigNumberish,
    quote?: FeeQuote,
    pstatus?: AccountStatus,
    callback?: (bundle: commons.transaction.IntendedTransactionBundle) => void,
    projectAccessKey?: string,
    waitForReceipt?: boolean
  ): Promise<ethers.TransactionResponse> {
    if (!Array.isArray(signedBundle)) {
      return this.sendSignedTransactions([signedBundle], chainId, quote, pstatus, callback, projectAccessKey)
    }
    const status = pstatus || (await this.status(chainId))
    this.mustBeFullyMigrated(status)

    const decoratedBundle = await this.decorateTransactions(signedBundle, status, chainId)
    callback?.(decoratedBundle)

    return this.relayer(chainId).relay(decoratedBundle, quote, waitForReceipt, projectAccessKey)
  }

  async fillGasLimits(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    status?: AccountStatus
  ): Promise<commons.transaction.SimulatedTransaction[]> {
    const wallet = this.walletForStatus(chainId, status || (await this.status(chainId)))
    return wallet.fillGasLimits(txs)
  }

  async gasRefundQuotes(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    stubSignatureOverrides: Map<string, string>,
    status?: AccountStatus,
    options?: {
      simulate?: boolean
      projectAccessKey?: string
    }
  ): Promise<{
    options: FeeOption[]
    quote?: FeeQuote
    decorated: commons.transaction.IntendedTransactionBundle
  }> {
    const wstatus = status || (await this.status(chainId))
    const wallet = this.walletForStatus(chainId, wstatus)

    const predecorated = await this.predecorateTransactions(txs, wstatus, chainId)
    const transactions = commons.transaction.fromTransactionish(this.address, predecorated)

    // We can't sign the transactions (because we don't want to bother the user)
    // so we use the latest configuration to build a "stub" signature, the relayer
    // knows to ignore the wallet signatures
    const stubSignature = wallet.coders.config.buildStubSignature(wallet.config, stubSignatureOverrides)

    // Now we can decorate the transactions as always, but we need to manually build the signed bundle
    const intentId = ethers.hexlify(ethers.randomBytes(32))
    const signedBundle: commons.transaction.SignedTransactionBundle = {
      chainId,
      intent: {
        id: intentId,
        wallet: this.address
      },
      signature: stubSignature,
      transactions,
      entrypoint: this.address,
      nonce: 0 // The relayer also ignored the nonce
    }

    const decoratedBundle = await this.decorateTransactions(signedBundle, wstatus)
    const data = commons.transaction.encodeBundleExecData(decoratedBundle)
    const res = await this.relayer(chainId).getFeeOptionsRaw(decoratedBundle.entrypoint, data, options)
    return { ...res, decorated: decoratedBundle }
  }

  async prepareTransactions(args: {
    txs: commons.transaction.Transactionish
    chainId: ethers.BigNumberish
    stubSignatureOverrides: Map<string, string>
    simulateForFeeOptions?: boolean
    projectAccessKey?: string
  }): Promise<PreparedTransactions> {
    const status = await this.status(args.chainId)

    const transactions = await this.fillGasLimits(args.txs, args.chainId, status)
    const gasRefundQuote = await this.gasRefundQuotes(transactions, args.chainId, args.stubSignatureOverrides, status, {
      simulate: args.simulateForFeeOptions,
      projectAccessKey: args.projectAccessKey
    })
    const flatDecorated = commons.transaction.unwind(this.address, gasRefundQuote.decorated.transactions)

    return {
      transactions,
      flatDecorated,
      feeOptions: gasRefundQuote.options,
      feeQuote: gasRefundQuote.quote
    }
  }

  async sendTransaction(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    quote?: FeeQuote,
    skipPreDecorate: boolean = false,
    callback?: (bundle: commons.transaction.IntendedTransactionBundle) => void,
    options?: {
      nonceSpace?: ethers.BigNumberish
      serial?: boolean
      projectAccessKey?: string,
      waitForReceipt?: boolean
    }
  ): Promise<ethers.TransactionResponse | undefined> {
    const status = await this.status(chainId)

    const predecorated = skipPreDecorate ? txs : await this.predecorateTransactions(txs, status, chainId)
    const hasTxs = commons.transaction.fromTransactionish(this.address, predecorated).length > 0
    const signed = hasTxs ? await this.signTransactions(predecorated, chainId, undefined, options) : undefined

    const childBundles = await this.orchestrator.predecorateSignedTransactions({ chainId })

    const bundles: commons.transaction.SignedTransactionBundle[] = []
    if (signed !== undefined && signed.transactions.length > 0) {
      bundles.push(signed)
    }
    bundles.push(...childBundles.filter(b => b.transactions.length > 0))

    return this.sendSignedTransactions(bundles, chainId, quote, undefined, callback, options?.projectAccessKey, options?.waitForReceipt)
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, Array<ethers.TypedDataField>>,
    message: Record<string, any>,
    chainId: ethers.BigNumberish,
    cantValidateBehavior: 'ignore' | 'eip6492' | 'throw' = 'ignore'
  ): Promise<string> {
    const digest = encodeTypedDataDigest({ domain, types, message })
    return this.signDigest(digest, chainId, true, cantValidateBehavior)
  }

  async getSigners(): Promise<Array<{ address: string; network: ChainId; weight: number }>> {
    const last = <T>(ts: T[]): T | undefined => (ts.length ? ts[ts.length - 1] : undefined)

    return (
      await Promise.all(
        this.networks.map(async ({ chainId, name }) => {
          try {
            const status = await this.status(chainId)

            let latestImageHash = last(status.presignedConfigurations)?.nextImageHash
            if (!latestImageHash) {
              if (status.onChain.version !== status.version) {
                const migration = last(status.signedMigrations)
                if (migration) {
                  const { toVersion, toConfig } = migration
                  const coder = universal.genericCoderFor(toVersion)
                  latestImageHash = coder.config.imageHashOf(toConfig)
                }
              }
            }
            if (!latestImageHash) {
              latestImageHash = status.onChain.imageHash
            }

            const latestConfig = await this.tracker.configOfImageHash({ imageHash: latestImageHash })
            if (!latestConfig) {
              throw new Error(`unable to find config for image hash ${latestImageHash}`)
            }

            const coder = universal.genericCoderFor(latestConfig.version)
            const signers = coder.config.signersOf(latestConfig)

            return signers.map(signer => ({ ...signer, network: chainId }))
          } catch (error) {
            console.warn(`unable to get signers on network ${chainId} ${name}`, error)
            return []
          }
        })
      )
    ).flat()
  }

  async getAllSigners(): Promise<
    {
      address: string
      weight: number
      network: number
      flaggedForRemoval: boolean
    }[]
  > {
    const allSigners: {
      address: string
      weight: number
      network: number
      flaggedForRemoval: boolean
    }[] = []

    // We need to get the signers for each status
    await Promise.all(
      this.networks.map(async network => {
        const chainId = network.chainId

        // Getting the status with `longestPath` set to true will give us all the possible configurations
        // between the current onChain config and the latest config, including the ones "flagged for removal"
        const status = await this.status(chainId, true)

        const fullChain = [
          status.onChain.imageHash,
          ...(status.onChain.version !== status.version
            ? status.signedMigrations.map(m => universal.coderFor(m.toVersion).config.imageHashOf(m.toConfig as any))
            : []),
          ...status.presignedConfigurations.map(update => update.nextImageHash)
        ]

        return Promise.all(
          fullChain.map(async (nextImageHash, iconf) => {
            const isLast = iconf === fullChain.length - 1
            const config = await this.tracker.configOfImageHash({ imageHash: nextImageHash })

            if (!config) {
              console.warn(`AllSigners may be incomplete, config not found for imageHash ${nextImageHash}`)
              return
            }

            const coder = universal.genericCoderFor(config.version)
            const signers = coder.config.signersOf(config)

            signers.forEach(signer => {
              const exists = allSigners.find(s => s.address === signer.address && s.network === chainId)

              if (exists && isLast && exists.flaggedForRemoval) {
                exists.flaggedForRemoval = false
                return
              }

              if (exists) return

              allSigners.push({
                address: signer.address,
                weight: signer.weight,
                network: chainId,
                flaggedForRemoval: !isLast
              })
            })
          })
        )
      })
    )

    return allSigners
  }
}

export function isAccount(value: any): value is Account {
  return value instanceof Account
}

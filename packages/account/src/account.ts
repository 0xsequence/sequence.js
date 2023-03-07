
import { tracker } from '@0xsequence/sessions'
import { migrator, defaults, version } from '@0xsequence/migration'
import { Orchestrator } from '@0xsequence/signhub'
import { NetworkConfig } from '@0xsequence/network'
import { ethers, TypedDataDomain, TypedDataField } from 'ethers'
import { commons, universal } from '@0xsequence/core'
import { PresignedConfigLink } from '@0xsequence/sessions/src/tracker'
import { Wallet } from '@0xsequence/wallet'
import { FeeOption, FeeQuote, isRelayer, Relayer, RpcRelayer } from '@0xsequence/relayer'
import { encodeTypedDataDigest } from '@0xsequence/utils'

export type AccountStatus = {
  original: {
    version: number,
    imageHash: string,
    context: commons.context.WalletContext
  }
  onChain: {
    imageHash: string,
    config: commons.config.Config,
    version: number,
    deployed: boolean
  },
  fullyMigrated: boolean,
  signedMigrations: migrator.SignedMigration[],
  version: number,
  presignedConfigurations: PresignedConfigLink[],
  imageHash: string,
  config: commons.config.Config,
  checkpoint: ethers.BigNumberish,
  canOnchainValidate: boolean,
}

export type AccountOptions = {
  // The only unique identifier for a wallet is the address
  address: string,

  // The config tracker keeps track of chained configs,
  // counterfactual addresses and reverse lookups for configurations
  // it must implement both the ConfigTracker and MigrationTracker
  tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker,

  // Versioned contexts contains the context information for each Sequence version
  contexts: commons.context.VersionedContext

  // Optional list of migrations, if not provided, the default migrations will be used
  // NOTICE: the last vestion is considered the "current" version for the account
  migrations?: migrator.Migrations

  // Orchestrator manages signing messages and transactions
  orchestrator: Orchestrator

  // Networks information and providers
  networks: NetworkConfig[]
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

  async nonce(_wallet: string, _space: ethers.BigNumberish): Promise<ethers.BigNumberish> {
    return ethers.constants.Zero
  }

  async isValidSignature(_wallet: string, _digest: ethers.utils.BytesLike, _signature: ethers.utils.BytesLike): Promise<boolean> {
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

  private orchestrator: Orchestrator

  constructor(options: AccountOptions) {
    this.address = ethers.utils.getAddress(options.address)

    this.contexts = options.contexts
    this.tracker = options.tracker
    this.networks = options.networks
    this.orchestrator = options.orchestrator

    this.migrations = options.migrations || defaults.DefaultMigrations
    this.migrator = new migrator.Migrator(options.tracker, this.migrations, this.contexts)
  }

  static async new(options: {
    config: commons.config.SimpleConfig,
    tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker,
    contexts: commons.context.VersionedContext,
    orchestrator: Orchestrator,
    networks: NetworkConfig[],
    migrations?: migrator.Migrations
  }): Promise<Account> {
    const mig = new migrator.Migrator(
      options.tracker,
      options.migrations ?? defaults.DefaultMigrations,
      options.contexts
    )

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
      migrations: options.migrations
    })
  }

  get version(): number {
    return this.migrator.lastMigration().version
  }

  get coders(): {
    signature: commons.signature.SignatureCoder,
    config: commons.config.ConfigCoder,
  } {
    const lastMigration = this.migrator.lastMigration()

    return {
      signature: lastMigration.signatureCoder,
      config: lastMigration.configCoder
    }
  }

  network(chainId: ethers.BigNumberish): NetworkConfig {
    const tcid = ethers.BigNumber.from(chainId)
    const found = this.networks.find((n) => tcid.eq(n.chainId))
    if (!found) throw new Error(`Network not found for chainId ${chainId}`)
    return found
  }

  provider(chainId: ethers.BigNumberish): ethers.providers.Provider {
    const found = this.network(chainId)
    if (!found.provider && !found.rpcUrl) throw new Error(`Provider not found for chainId ${chainId}`)
    return found.provider || new ethers.providers.JsonRpcProvider(found.rpcUrl)
  }

  reader(chainId: ethers.BigNumberish): commons.reader.Reader {
    if (ethers.constants.Zero.eq(chainId)) return new Chain0Reader()

    // TODO: Networks should be able to provide a reader directly
    // and we should default to the on-chain reader
    return new commons.reader.OnChainReader(this.provider(chainId))
  }

  relayer(chainId: ethers.BigNumberish): Relayer {
    const found = this.network(chainId)
    if (!found.relayer) throw new Error(`Relayer not found for chainId ${chainId}`)
    if (isRelayer(found.relayer)) return found.relayer
    return new RpcRelayer(found.relayer)
  }

  setOrchestrator(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator
  }

  contextFor(version: number): commons.context.WalletContext {
    const ctx = this.contexts[version]
    if (!ctx) throw new Error(`Context not found for version ${version}`)
    return ctx
  }

  walletForStatus(
    chainId: ethers.BigNumberish,
    status: AccountStatus
  ): Wallet {
    const coder = universal.coderFor(status.version)
    return this.walletFor(
      chainId,
      this.contextFor(status.version),
      status.config,
      coder,
    )
  }

  walletFor(
    chainId: ethers.BigNumberish,
    context: commons.context.WalletContext,
    config: commons.config.Config,
    coders: typeof this.coders
  ): Wallet {
    const isNetworkZero = ethers.constants.Zero.eq(chainId)
    return new Wallet({
      config,
      context,
      chainId,
      coders,
      relayer: isNetworkZero ? undefined : this.relayer(chainId),
      address: this.address,
      orchestrator: this.orchestrator,
      reader: this.reader(chainId),
    })
  }

  // Gets the current on-chain version of the wallet
  // on a given network
  async onchainVersionInfo(chainId: ethers.BigNumberish): Promise<{
    first: {
      imageHash: string,
      context: commons.context.WalletContext,
      version: number
    }
    current: number
  }> {
    // First we need to use the tracker to get the counterfactual imageHash
    const firstImageHash = await this.tracker.imageHashOfCounterfactualWallet({
      wallet: this.address
    })

    if (!firstImageHash) {
      throw new Error(`Counterfactual imageHash not found for wallet ${this.address}`)
    }

    const current = await version.versionOf(
      this.address,
      firstImageHash.imageHash,
      this.contexts,
      this.reader(chainId)
    )

    // To find the first version, we need to try the firstImageHash
    // with every context, and find the first one that matches
    const first = version.counterfactualVersion(
      this.address,
      firstImageHash.imageHash,
      Object.values(this.contexts),
    )

    return { first: { ...firstImageHash, version: first }, current }
  }

  // Get the status of the account on a given network
  // this does the following process:
  // 1. Get the current on-chain status of the wallet (version + imageHash)
  // 2. Get any pending migrations that have been signed by the wallet
  // 3. Get any pending configuration updates that have been signed by the wallet
  // 4. Fetch reverse lookups for both on-chain and pending configurations
  async status(chainId: ethers.BigNumberish, longestPath: boolean = false): Promise<AccountStatus> {
    const isDeployedPromise = this.reader(chainId).isDeployed(this.address)
    const onChainVersionInfoPromise = this.onchainVersionInfo(chainId)

    let onChainImageHash = await this.reader(chainId).imageHash(this.address)
    if (!onChainImageHash) {
      const counterfactualImageHash = await this.tracker.imageHashOfCounterfactualWallet({
        wallet: this.address
      })

      onChainImageHash = counterfactualImageHash?.imageHash
    }

    if (!onChainImageHash) {
      throw new Error(`On-chain imageHash not found for wallet ${this.address}`)
    }

    const onChainConfig = await this.tracker.configOfImageHash({ imageHash: onChainImageHash })
    if (!onChainConfig) {
      throw new Error(`On-chain config not found for imageHash ${onChainImageHash}`)
    }

    const { current: onChainVersion, first: onChainFirstInfo } = await onChainVersionInfoPromise

    let fromImageHash = onChainImageHash
    let version = onChainVersion
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
      version = presignedMigrate.lastVersion

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
    const checkpoint = universal.coderFor(version).config.checkpointOf(config as any)

    return {
      original: onChainFirstInfo,
      onChain: {
        imageHash: onChainImageHash,
        config: onChainConfig,
        version: onChainVersion,
        deployed: isDeployed
      },
      fullyMigrated: version === this.version,
      signedMigrations,
      version,
      presignedConfigurations: presigned,
      imageHash,
      config,
      checkpoint,
      canOnchainValidate: (
        version === this.version &&
        isDeployed
      )
    }
  }

  private mustBeFullyMigrated(status: AccountStatus) {
    if (!status.fullyMigrated) {
      throw new Error(`Wallet ${this.address} is not fully migrated`)
    }
  }

  async predecorateTransactions(
    txs: commons.transaction.Transactionish,
    status: AccountStatus,
    chainId: ethers.BigNumberish,
  ): Promise<commons.transaction.Transactionish> {
    // if onchain wallet config is not up to date
    // then we should append an extra transaction that updates it
    // to the latest "lazy" state
    if (status.onChain.imageHash !== status.imageHash) {
      const wallet = this.walletForStatus(chainId, status)
      const updateConfig = await wallet.buildUpdateConfigurationTransaction(status.config)
      return [(Array.isArray(txs) ? txs : [txs]), updateConfig.transactions].flat()
    }

    return txs
  }

  decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    status: AccountStatus,
  ): commons.transaction.IntendedTransactionBundle {
    const bootstrapBundle = this.buildBootstrapTransactions(status)
    if (bootstrapBundle.transactions.length === 0) {
      return bundle
    }

    return {
      entrypoint: bootstrapBundle.entrypoint,
      chainId: bundle.chainId,
      intent: bundle.intent,
      transactions: [
        ...bootstrapBundle.transactions,
       {
          to: bundle.entrypoint,
          data: commons.transaction.encodeBundleExecData(bundle),
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        }
      ]
    }
  }

  decorateSignature<T extends ethers.BytesLike>(
    signature: T,
    status: AccountStatus,
  ): T | string {
    if (status.presignedConfigurations.length === 0) {
      return signature
    }

    const coder = this.coders.signature

    const chain = status.presignedConfigurations.map((c) => c.signature)
    const chainedSignature = coder.chainSignatures(signature, chain)
    return coder.encode(chainedSignature)
  }

  async publishWitness(): Promise<void> {
    const digest = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`This is a Sequence account woo! ${Date.now()}`))
    const signature = await this.signDigest(digest, 0, false)
    const decoded = this.coders.signature.decode(signature)
    const signatures = this.coders.signature.signaturesOfDecoded(decoded)
    return this.tracker.saveWitnesses({ wallet: this.address, digest, chainId: 0, signatures })
  }

  async signDigest(
    digest: ethers.BytesLike,
    chainId: ethers.BigNumberish,
    decorate: boolean = true
  ): Promise<string> {
    // If we are signing a digest for chainId zero then we can never be fully migrated
    // because Sequence v1 doesn't allow for signing a message on "all chains"

    // So we ignore the state on "chain zero" and instead use one of the states of the networks
    // wallet-webapp should ensure the wallet is as migrated as possible, trying to mimic
    // the behaviour of being migrated on all chains

    const chainRef = ethers.constants.Zero.eq(chainId) ? this.networks[0].chainId : chainId
    const status = await this.status(chainRef)

    this.mustBeFullyMigrated(status)

    const wallet = this.walletForStatus(chainId, status)
    const signature = await wallet.signDigest(digest)

    return decorate ? this.decorateSignature(signature, status) : signature
  }

  async editConfig(
    changes: {
      add?: commons.config.SimpleSigner[];
      remove?: string[];
      threshold?: ethers.BigNumberish;
    }
  ): Promise<void> {
    const currentConfig = await this.status(0).then((s) => s.config)
    const newConfig = this.coders.config.editConfig(currentConfig, {
      ...changes,
      checkpoint: this.coders.config.checkpointOf(currentConfig).add(1)
    })

    return this.updateConfig(newConfig)
  }

  async updateConfig(
    config: commons.config.Config
  ): Promise<void> {
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
    return this.tracker.savePresignedConfiguration({
      wallet: this.address,
      nextConfig: config,
      signature
    })
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
  buildBootstrapTransactions(
    status: AccountStatus
  ): commons.transaction.TransactionBundle {
    const transactions: commons.transaction.Transaction[] = []

    // Add wallet deployment if needed
    if (!status.onChain.deployed) {
      // Wallet deployment will vary depending on the version
      // so we need to use the context to get the correct deployment
      const deployTransaction = Wallet.buildDeployTransaction(
        status.original.context,
        status.original.imageHash
      )

      transactions.push(...deployTransaction.transactions)
    }

    // Get pending migrations
    transactions.push(...status.signedMigrations.map((m) => ({
      to: m.tx.entrypoint,
      data: commons.transaction.encodeBundleExecData(m.tx),
      value: 0,
      gasLimit: 0,
      revertOnError: true,
      delegateCall: false
    })))

    // Everything is encoded as a bundle
    // using the GuestModule of the account version
    const { guestModule } = this.contextFor(status.version)
    return { entrypoint: guestModule, transactions }
  }

  async bootstrapTransactions(
    chainId: ethers.BigNumberish,
  ): Promise<commons.transaction.TransactionBundle> {
    const status = await this.status(chainId)
    return this.buildBootstrapTransactions(status)
  }

  async doBootstrap(
    chainId: ethers.BigNumberish,
    feeQuote?: FeeQuote
  ) {
    const bootstrapTxs = await this.bootstrapTransactions(chainId)
    const intended = commons.transaction.intendTransactionBundle(
      bootstrapTxs,
      this.address,
      chainId,
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )

    return this.relayer(chainId).relay(intended, feeQuote)
  }

  signMessage(message: ethers.BytesLike, chainId: ethers.BigNumberish): Promise<string> {
    return this.signDigest(ethers.utils.keccak256(message), chainId)
  }

  async signTransactions(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    pstatus?: AccountStatus
  ): Promise<commons.transaction.SignedTransactionBundle> {
    const status = pstatus || await this.status(chainId)
    this.mustBeFullyMigrated(status)

    const wallet = this.walletForStatus(chainId, status)
    const signed = await wallet.signTransactions(txs)

    return {
      ...signed,
      signature: this.decorateSignature(signed.signature, status)
    }
  }

  async signMigrations(chainId: ethers.BigNumberish, editConfig: (prevConfig: commons.config.Config) => commons.config.Config): Promise<boolean> {
    const status = await this.status(chainId)
    if (status.fullyMigrated) return false

    const wallet = this.walletForStatus(chainId, status)
    const signed = await this.migrator.signNextMigration(this.address, status.version, wallet, editConfig(wallet.config))
    if (!signed) return false

    await this.tracker.saveMigration(this.address, signed, this.contexts)
    return true
  }

  async signAllMigrations(editConfig: (prevConfig: commons.config.Config) => commons.config.Config) {
    return Promise.all(this.networks.map((n) => this.signMigrations(n.chainId, editConfig)))
  }

  async isMigratedAllChains(): Promise<boolean> {
    const statuses = await Promise.all(this.networks.map((n) => this.status(n.chainId)))
    return statuses.every((s) => s.fullyMigrated)
  }

  async sendSignedTransactions(
    signedBundle: commons.transaction.IntendedTransactionBundle,
    chainId: ethers.BigNumberish,
    quote?: FeeQuote,
    pstatus?: AccountStatus
  ): Promise<ethers.providers.TransactionResponse> {
    const status = pstatus || await this.status(signedBundle.chainId)
    this.mustBeFullyMigrated(status)

    const decoratedBundle = this.decorateTransactions(signedBundle, status)

    return this.relayer(chainId).relay(decoratedBundle, quote)
  }

  async fillGasLimits(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    status?: AccountStatus
  ): Promise<commons.transaction.SimulatedTransaction[]> {
    const wallet = this.walletForStatus(chainId, status || await this.status(chainId))
    return wallet.fillGasLimits(txs)
  }

  async gasRefundQuotes(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    stubSignatureOverrides: Map<string, string>,
    status?: AccountStatus
  ): Promise<{
    options: FeeOption[];
    quote?: FeeQuote,
    decorated: commons.transaction.IntendedTransactionBundle
  }> {
    const transactions = commons.transaction.fromTransactionish(this.address, txs)

    const wstatus = status || await this.status(chainId)
    const wallet = this.walletForStatus(chainId, wstatus)

    // We can't sign the transactions (because we don't want to bother the user)
    // so we use the latest configuration to build a "stub" signature, the relayer
    // knows to ignore the wallet signatures
    const stubSignature = wallet.coders.config.buildStubSignature(wallet.config, stubSignatureOverrides)

    // Now we can decorate the transactions as always, but we need to manually build the signed bundle
    const intentId = ethers.utils.hexlify(ethers.utils.randomBytes(32))
    const signedBundle: commons.transaction.SignedTransactionBundle = {
      chainId,
      intent: {
        id: intentId,
        wallet: this.address,
      },
      signature: stubSignature,
      transactions,
      entrypoint: this.address,
      nonce: 0 // The relayer also ignored the nonce
    }

    const decoratedBundle = this.decorateTransactions(signedBundle, wstatus)
    const data = commons.transaction.encodeBundleExecData(decoratedBundle)
    const res = await this.relayer(chainId).getFeeOptionsRaw(decoratedBundle.entrypoint, data)
    return { ...res, decorated: decoratedBundle }
  }

  async prepareTransactions(args: {
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    stubSignatureOverrides: Map<string, string>
  }): Promise<{
    transactions: commons.transaction.SimulatedTransaction[],
    flatDecorated: commons.transaction.Transaction[],
    options: FeeOption[],
    quote?: FeeQuote
  }> {
    const status = await this.status(args.chainId)

    const transactions = await this.fillGasLimits(args.txs, args.chainId, status)
    const gasRefundQuote = await this.gasRefundQuotes(transactions, args.chainId, args.stubSignatureOverrides, status)
    const flatDecorated = commons.transaction.unwind(this.address, gasRefundQuote.decorated.transactions)

    return {
      transactions,
      flatDecorated,
      options: gasRefundQuote.options,
      quote: gasRefundQuote.quote
    }
  }

  async sendTransaction(
    txs: commons.transaction.Transactionish,
    chainId: ethers.BigNumberish,
    quote?: FeeQuote,
    skipPreDecorate: boolean = false
  ): Promise<ethers.providers.TransactionResponse> {
    const status = await this.status(chainId)
    const predecorated = skipPreDecorate ? txs : await this.predecorateTransactions(txs, status, chainId)
    const signed = await this.signTransactions(predecorated, chainId)
    return this.sendSignedTransactions(signed, chainId, quote)
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId: ethers.BigNumberish
  ): Promise<string> {
    const digest = encodeTypedDataDigest({ domain, types, message })
    return this.signDigest(digest, chainId)
  }

  async getAllSigners(): Promise<{
    address: string,
    weight: number,
    network: number,
    flaggedForRemoval: boolean
  }[]> {
    const networks = this.networks

    // Getting all status with `longestPath` set to true will give us all the possible configurations
    // between the current onChain config and the latest config, including the ones "flagged for removal"
    const statuses = await Promise.all(networks.map((n) => this.status(n.chainId, true)))

    const allSigners: {
      address: string,
      weight: number,
      network: number,
      flaggedForRemoval: boolean
    }[] = []

    // We need to get the signers for each status
    await Promise.all(statuses.map(async (status, inet) => {
      const chainId = networks[inet].chainId
      return Promise.all(status.presignedConfigurations.map(async (update, iconf) => {
        const isLast = iconf === status.presignedConfigurations.length - 1
        const config = await this.tracker.configOfImageHash({ imageHash: update.nextImageHash })
        if (!config) {
          console.warn(`AllSigners may be incomplete, config not found for imageHash ${update.nextImageHash}`)
          return
        }

        const coder = universal.genericCoderFor(config.version)
        const signers = coder.config.signersOf(config)

        signers.forEach((signer) => {
          const exists = allSigners.find((s) => (
            s.address === signer.address &&
            s.network === chainId
          ))

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
      }))
    }))

    return allSigners
  }
}

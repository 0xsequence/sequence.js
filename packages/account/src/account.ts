
import { tracker } from '@0xsequence/sessions'
import { migrator, context, defaults, version } from '@0xsequence/migration'
import { Orchestrator } from '@0xsequence/signhub'
import { NetworkConfig } from '@0xsequence/network'
import { ethers } from 'ethers'
import { commons, universal } from '@0xsequence/core'
import { PresignedConfigUpdate } from '@0xsequence/sessions/src/tracker'
import { counterfactualVersion } from '@0xsequence/migration/src/version'
import { Wallet } from '@0xsequence/wallet'

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
  presignedConfigurations: PresignedConfigUpdate[],
  imageHash: string,
  config: commons.config.Config,
}

export type AccountOptions = {
  // The only unique identifier for a wallet is the address
  address: string,

  // The config tracker keeps track of chained configs,
  // counterfactual addresses and reverse lookups for configurations
  // it must implement both the ConfigTracker and MigrationTracker
  tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker,

  // Versioned contexts contains the context information for each Sequence version
  contexts: context.VersionedContext

  // Optional list of migrations, if not provided, the default migrations will be used
  // NOTICE: the last vestion is considered the "current" version for the account
  migrations?: migrator.Migrations

  // Orchestrator manages signing messages and transactions
  orchestrator: Orchestrator

  // Networks information and providers
  networks: NetworkConfig[]
}

export class Account {
  public readonly address: string

  public readonly networks: NetworkConfig[]
  public readonly tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  public readonly contexts: context.VersionedContext

  public readonly migrator: migrator.Migrator
  public readonly migrations: migrator.Migrations

  private readonly orchestrator: Orchestrator

  constructor(options: AccountOptions) {
    this.address = ethers.utils.getAddress(options.address)

    this.contexts = options.contexts
    this.tracker = options.tracker
    this.networks = options.networks
    this.orchestrator = options.orchestrator

    this.migrations = options.migrations || defaults.DefaultMigrations
    this.migrator = new migrator.Migrator(options.tracker, {}, this.contexts)
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
    const found = this.networks.find(n => tcid.eq(chainId))
    if (!found) throw new Error(`Network not found for chainId ${chainId}`)
    return found
  }

  provider(chainId: ethers.BigNumberish): ethers.providers.Provider {
    const found = this.network(chainId)
    if (!found.provider) throw new Error(`Provider not found for chainId ${chainId}`)
    return found.provider
  }

  reader(chainId: ethers.BigNumberish): commons.reader.Reader {
    // TODO: Networks should be able to provide a reader directly
    // and we should default to the on-chain reader
    return new commons.reader.OnChainReader(this.address, this.provider(chainId))
  }

  contextFor(version: number): commons.context.WalletContext {
    const ctx = this.contexts[version]
    if (!ctx) throw new Error(`Context not found for version ${version}`)
    return ctx
  }

  walletFor(
    chainId: ethers.BigNumberish,
    context: commons.context.WalletContext,
    config: commons.config.Config,
    coders: typeof this.coders
  ): Wallet {
    return new Wallet({
      config,
      context,
      chainId,
      coders,
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
    // First we need to use the tracker to get the counter-factual imageHash
    const firstImageHash = await this.tracker.imageHashOfCounterFactualWallet({
      context: Object.values(this.contexts),
      wallet: this.address
    })

    if (!firstImageHash) {
      throw new Error(`Counter-factual imageHash not found for wallet ${this.address}`)
    }

    const current = await version.versionOf(
      this.address,
      firstImageHash.imageHash,
      this.contexts,
      this.reader(chainId)
    )

    // To find the first version, we need to try the firstImageHash
    // with every context, and find the first one that matches
    const first = counterfactualVersion(
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
  async status(chainId: ethers.BigNumberish): Promise<AccountStatus> {
    const isDeployedPromise = this.reader(chainId).isDeployed()
    const onChainVersionInfoPromise = this.onchainVersionInfo(chainId)

    const onChainImageHash = await this.reader(chainId).imageHash()

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
      checkpoint: universal.genericCoderFor(onChainConfig.version).config.checkpointOf(onChainConfig),
    })

    const imageHash = presigned && presigned.length > 0 ? presigned[presigned.length - 1].nextImageHash : onChainImageHash
    const config = imageHash !== onChainImageHash ? await this.tracker.configOfImageHash({ imageHash }) : onChainConfig
    if (!config) {
      throw new Error(`Config not found for imageHash ${imageHash}`)
    }

    return {
      original: onChainFirstInfo,
      onChain: {
        imageHash: onChainImageHash,
        config: onChainConfig,
        version: onChainVersion,
        deployed: await isDeployedPromise
      },
      fullyMigrated: version === this.version,
      signedMigrations,
      version,
      presignedConfigurations: presigned,
      imageHash,
      config
    }
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

  async signDigest(
    digest: ethers.BytesLike,
    chainId: ethers.BigNumberish
  ): Promise<string> {
    const status = await this.status(chainId)

    if (!status.fullyMigrated) {
      throw new Error(`Wallet ${this.address} is not fully migrated`)
    }

    const context = this.contextFor(status.version)
    const coder = universal.coderFor(status.version)
    const wallet = this.walletFor(chainId, context, status.config, coder)
    const signature = await wallet.signDigest(digest)

    return this.decorateSignature(signature, status)
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
    const { guestModule } = this.contextFor(this.version)
    return { entrypoint: guestModule, transactions }
  }

  async bootstrapTransactions(
    chainId: ethers.BigNumberish,
  ): Promise<commons.transaction.TransactionBundle> {
    const status = await this.status(chainId)
    return this.buildBootstrapTransactions(status)
  }
}

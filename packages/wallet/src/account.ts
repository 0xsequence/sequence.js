import { TransactionResponse, JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, BytesLike, ethers } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Deferrable } from '@ethersproject/properties'
import { SignedTransactionsCallback, Signer } from './signer'
import { Transactionish, Transaction, TransactionRequest, unpackMetaTransactionData, sequenceTxAbiEncode, SignedTransactionBundle, TransactionBundle, encodeBundleExecData, packMetaTransactionsData, encodeNonce } from '@0xsequence/transactions'
import { WalletConfig, WalletState, ConfigTracker, imageHash, encodeSignature, SESSIONS_SPACE, addressOf , hasImplementationUpdate, decodeSignature } from '@0xsequence/config'
import {
  ChainIdLike,
  NetworkConfig,
  WalletContext,
  sequenceContext,
  mainnetNetworks,
  getChainId,
  maybeChainId
} from '@0xsequence/network'
import { Wallet } from './wallet'
import { FeeOption, FeeQuote, isRpcRelayerOptions, Relayer, RpcRelayer } from '@0xsequence/relayer'
import { fetchImageHash, getImplementation, isWalletDeployed } from '.'
import { walletContracts } from '@0xsequence/abi'
import { Interface } from '@ethersproject/abi'

export interface AccountOptions {
  // The only unique identifier for a wallet is they address
  address: string,

  // The config tracker keeps track of the lazy (octopus) configuration
  // applies pending configurations, and stores new ones
  configTracker: ConfigTracker,

  networks?: NetworkConfig[]
  context?: WalletContext
}

// Account is an interface to a multi-network smart contract wallet.
export class Account extends Signer {
  private readonly options: AccountOptions

  private _context: WalletContext
  private _networks: NetworkConfig[]
  private _signers: (BytesLike | AbstractSigner)[]

  private _providers: { [chainId: number]: JsonRpcProvider } = {}
  private _relayers: { [chainId: number]: Relayer } = {}

  // provider points at the main chain for compatability with the Signer.
  // Use getProvider(chainId) to get the provider for the respective network.
  provider: JsonRpcProvider

  private _defaultChainId: number | undefined

  constructor(options: AccountOptions, ...signers: (BytesLike | AbstractSigner)[]) {
    super()

    this.options = options
    this._signers = signers

    // Use deployed wallet context by default if not provided
    this._context = options.context || sequenceContext

    // Network config, defaults will be used if none are provided
    this._networks = options.networks || mainnetNetworks

    // Networks can't be empty
    if (this._networks.length === 0) {
      throw new Error('Empty network array provided')
    }
  }

  public static async create(
    options: Omit<AccountOptions, 'address'>,
    config: WalletConfig,
    ...signers: (BytesLike | AbstractSigner)[]
  ): Promise<Account> {
    // Compute initial address of wallet
    const context = options.context || sequenceContext
    const address = addressOf(config, context)

    // Store counter-factual wallet on config tracker
    await Promise.all([
      options.configTracker.saveCounterFactualWallet({ context, imageHash: imageHash(config) }),
      options.configTracker.saveWalletConfig({ config })
    ])

    // Create account instance
    return new Account({
      ...options,
      address,
    }, ...signers)
  }

  public useSigners(...signers: (BytesLike | AbstractSigner)[]): Account {
    this._signers = signers
    return this
  }

  async setDefaultNetwork(chainId: ChainIdLike): Promise<void> {
    // Requested default chainId must be in the network array
    const network = this._networks.find((n) => n.chainId === maybeChainId(chainId))
    if (!network) throw new Error(`Invalid default network ${chainId}`)

    // Set default chainId
    this._defaultChainId = maybeChainId(chainId)
  }

  async getFeeOptions(bundle: TransactionBundle, chainId?: ChainIdLike): Promise<{ options: FeeOption[], quote?: FeeQuote }> {
    // Decorate bundle in deploy/update
    const decorated = await this.decorateTransactions(bundle, chainId)

    const cid = maybeChainId(chainId) ?? this.defaultChainId
    const relayer = await this.getRelayer(cid)
    return relayer?.getFeeOptions(decorated) ?? { options: [], quote: undefined }
  }

  private async _getWallet(chainId?: ChainIdLike): Promise<Wallet | undefined> {
    const cid = maybeChainId(chainId) ?? this.defaultChainId

    const provider = await this.getProvider(cid)
    if (!provider) return undefined

    const relayer = await this.getRelayer(cid)
    if (!relayer) return undefined

    const config = await this.getWalletConfig(cid)
    if (!config) return undefined
    
    return new Wallet({
      config,
      context: this._context,
    }, ...this._signers).connect(provider, relayer)
  }

  get defaultChainId(): number {
    return this._defaultChainId || this._networks.find((n) => n.isDefaultChain)?.chainId ||  this._networks[0].chainId
  }

  async getChainId(): Promise<number> {
    return this.defaultChainId
  }

  get address(): string {
    return this.options.address
  }

  async getAddress(): Promise<string> {
    return this.options.address
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    // If explicit defaultChain is set, mutate the array
    // to define only it as the default network
    if (this._defaultChainId) {
      const mutated = this._networks.map((n) => ({ ...n, isDefaultChain: n.chainId === this._defaultChainId }))

      // By-design the default network is always the first one
      // TODO: Remove this, order of networks should not matter
      return mutated.sort((a, b) => a.isDefaultChain ? -1 : b.isDefaultChain ? 1 : 0)
    }

    return this._networks
  }

  async getNetwork(chainId?: ChainIdLike): Promise<NetworkConfig | undefined> {
    const cid = maybeChainId(chainId) ?? this.defaultChainId
    return this._networks.find((n) => n.chainId === cid)
  }

  async getWalletContext(): Promise<WalletContext> {
    return this._context
  }

  async getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    // Get network config for chainId
    const network = await this.getNetwork(chainId)
    if (!network) return undefined

    // Return cached provider if available
    if (this._providers[network.chainId]) return this._providers[network.chainId]

    // Create provider if not
    // provider may be passed as network.provider or network.rpcUrl, network.provider has priority
    const provider = network.provider ? network.provider : network.rpcUrl ? new ethers.providers.JsonRpcProvider(network.rpcUrl) : undefined
    if (!provider) return undefined

    // Cache provider
    this._providers[network.chainId] = provider

    return provider
  }

  async getRelayer(chainId?: number): Promise<Relayer | undefined> {
    // Get network config for chainId
    const network = await this.getNetwork(chainId)
    if (!network) return undefined

    // Return cached relayer if available
    if (this._relayers[network.chainId]) return this._relayers[network.chainId]

    // Cheate new relayer if not
    if (!network.relayer) return undefined
    const relayer = isRpcRelayerOptions(network.relayer) ? new RpcRelayer(network.relayer) : network.relayer

    // Cache relayer
    this._relayers[network.chainId] = relayer

    return relayer
  }

  // Return the highest lazy configuration available for the given chainId
  async getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig | undefined> {
    // Get latest config for wallet using the config tracker
    const cid = maybeChainId(chainId) || this.defaultChainId

    // Get latest imageHash for wallet
    // if not available then we can't get the latest walletConfig either
    const provider = await this.getProvider(cid)
    if (!provider) return undefined

    const imageHash = await fetchImageHash(this.address, provider, { context: this._context, tracker: this.options.configTracker })
    if (!imageHash) return undefined

    const presigned = await this.options.configTracker.loadPresignedConfiguration({
      wallet: this.address,
      chainId: cid,
      fromImageHash: imageHash,
    })

    // If no pending presigned configuration
    // then the current imageHash is the latest config
    // and in that case we just need to fetch the config for it
    if (!presigned || presigned.length === 0) {
      const config = await this.options.configTracker.configOfImageHash({ imageHash })
      if (!config) return undefined
      return { ...config, address: this.address }
    }

    // If there are pending presigned configurations
    // then we take the imageHash of the last step, and map it to a config
    const config = await this.options.configTracker.configOfImageHash({ imageHash: presigned[presigned.length - 1].body.newImageHash })
    if (!config) return undefined
    return { ...config, address: this.address }
  }

  async getWalletState(chainId?: ChainIdLike): Promise<WalletState> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId

    // TODO: The following the promises can be solved by using a Promise.all
    
    // Get provider for network
    const provider = await this.getProvider(cid)
    if (!provider) throw new Error(`Provider not available for network ${cid}`)

    // Is the wallet deployed?
    const deployed = await isWalletDeployed(this.address, provider)

    // Get imageHash of wallet, this is the current imageHash on the actual chain
    // we only use it to know if the wallet is up to date or not on the chain
    const settledImageHash = await fetchImageHash(
      this.address,
      provider,
      {
        context: this._context,
        tracker: this.options.configTracker
      }
    )

    // Get latest config for wallet
    const config = await this.getWalletConfig(cid)
    const lazyImageHash = config && imageHash(config)

    // Wallet is upToDate if the imageHash of the wallet matches the latest config
    const published = lazyImageHash && settledImageHash ? lazyImageHash === settledImageHash : undefined

    return {
      address: this.address,
      context: this._context,
      chainId: cid,
      deployed,

      // This information may or may not be available
      config,
      published,
      imageHash: lazyImageHash,
    }
  }

  async isSettled(chainId?: ChainIdLike): Promise<boolean> {
    const state = await this.getWalletState(chainId)
    return state.deployed && state.published === true
  }

  getSigners(): Promise<string[]> {
    return Promise.all(this._signers.map((s) => {
      return (ethers.utils.isBytesLike(s) ? new ethers.Wallet(s) : s).getAddress()
    }))
  }

  async buildDeployTransaction(chainId?: ChainIdLike): Promise<Omit<TransactionBundle, "intent"> | undefined> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId

    // Get wallet state for network
    const state = await this.getWalletState(chainId)

    // If wallet is published and deployed, then we can just send the transactions as-is
    if (state.published && state.deployed) {
      return undefined
    }

    // List of transactions for GuestModule
    const guestTxs: Transaction[] = []

    // If wallet is not deployed, first we need to bundle the wallet deployment
    if (!state.deployed) {
      const factoryInterface = new Interface(walletContracts.factory.abi)

      const initialImageHash = await this.options.configTracker.imageHashOfCounterFactualWallet({ context: this._context, wallet: this.address })
      if (!initialImageHash) throw new Error('Error decorating transactions - No initial image hash found')

      guestTxs.push({
        to: this._context.factory,
        data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy'),
          [this._context.mainModule, initialImageHash]
        ),
        gasLimit: 100000,
        delegateCall: false,
        revertOnError: true,
        value: 0
      })
    }

    // If wallet is not up to date, then we need to pre-pend the presigned wallet update
    if (!state.published) {
      // Get provider
      const provider = await this.getProvider(cid)
      if (!provider) throw new Error(`Provider not available for network ${cid}`)

      // TODO: We are fetching the presigned transactions twice
      // it should be better to not use `getWalletState` and instead fetch that info directly
      // so we don't need to do it twice
      const settledImageHash = await fetchImageHash(this.address, provider, { context: this._context, tracker: this.options.configTracker })
      if (!settledImageHash) throw new Error('Error decorating transactions - No settled image hash found')

      const presignedConfig = await this.options.configTracker.loadPresignedConfiguration({
        wallet: this.address,
        chainId: state.chainId,
        fromImageHash: settledImageHash,
      })

      if (!presignedConfig || presignedConfig.length === 0) {
        throw new Error('Error decorating transactions - No presigned configuration found')
      }

      const walletInterface = new Interface(walletContracts.mainModule.abi)

      presignedConfig.map((pc) => {
        // Decode transactions data
        const subtxs = unpackMetaTransactionData(pc.body.tx)
        // Encode execute call
        const data = walletInterface.encodeFunctionData(
          walletInterface.getFunction('execute'), 
          [
            sequenceTxAbiEncode(subtxs),
            pc.body.nonce,
            pc.signature
          ]
        )

        guestTxs.push({
          to: this.address,
          data: data,
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        })
      })
    }

    // If guestModule is not defined
    // then we can't decorate the transactions like this
    const guestModule = this._context.guestModule
    if (!guestModule) {
      throw new Error('Error decorating transactions - Guest module is not defined')
    }

    return {
      entrypoint: guestModule,
      transactions: guestTxs,
      chainId: ethers.BigNumber.from(cid),
    }
  }

  async deploy(chainId?: ChainIdLike): Promise<TransactionResponse | undefined> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId

    const deployTx = await this.buildDeployTransaction(chainId)
    if (!deployTx) return undefined

    const relayer = await this.getRelayer(cid)
    if (!relayer) throw new Error(`Relayer not available for network ${chainId}`)

    return relayer.relay({ ...deployTx, intent: { digest: 'TODO: compute digest', wallet: this.address } })
  }

  async decorateTransactions(bundle: TransactionBundle, chainId?: ChainIdLike): Promise<TransactionBundle> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId

    // Get deploy transaction
    // this will deploy the wallet and update if needed
    const deployTx = await this.buildDeployTransaction(cid)
    if (!deployTx) {
      return bundle
    }

    // If bundle exist, append intent
    // and the bundle transactions at the end

    return {
      ...deployTx,
      intent: bundle.intent,
      transactions: [
        ...deployTx.transactions,
        {
          to: this.address,
          data: await encodeBundleExecData(bundle),
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        }
      ]
    }
  }

  async signMessage(
    message: BytesLike,
    chainId?: ChainIdLike,
    allSigners?: boolean,
    isDigest?: boolean
  ): Promise<string> {
    const wallet = await this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    return wallet.signMessage(message, chainId, allSigners, isDigest)
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    const wallet = await this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    // TODO: Append presigned update to signature
    // that way validation can validate it without querying sequence-sesions
    return wallet.signTypedData(domain, types, message, chainId, allSigners)
  }

  sendTransactionBatch(transactions: Deferrable<TransactionRequest[] | Transaction[]>, chainId?: ChainIdLike, allSigners?: boolean, quote?: FeeQuote): Promise<TransactionResponse> {
    return this.sendTransaction(transactions, chainId, allSigners, quote)
  }

  async sendTransaction(transaction: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners?: boolean, quote?: FeeQuote): Promise<TransactionResponse> {
    // Sign and send transactions using internal methods
    // these internal methods will decorate the transactions before relaying them
    // decoration appens wallet deployment or presigned wallet update
    const signed = await this.signTransactions(transaction, chainId, allSigners)
    return this.sendSignedTransactions(signed, chainId, quote)
  }

  async signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners?: boolean): Promise<SignedTransactionBundle> {
    const wallet = await this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    const signed = await wallet.signTransactions(txs, chainId, allSigners)
    const decorated = await this.decorateTransactions(signed, chainId)

    if (decorated.entrypoint === signed.entrypoint) {
      return signed
    }

    // TODO add nonce and signature to comply with SignedTransactionBundle
    // maybe we need to add a new type for GuestTransactionBundle and maybe details
    // about the original intent being signed or not

    return { ...decorated, nonce: ethers.constants.Zero, signature: "" }
  }

  async sendSignedTransactions(signedBundle: SignedTransactionBundle, chainId?: ChainIdLike, quote?: FeeQuote): Promise<TransactionResponse> {
    const wallet = await this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    return wallet.relayer.relay(signedBundle, quote)
  }

  async isDeployed(chainId?: ChainIdLike): Promise<boolean> {
    const cid = maybeChainId(chainId) ?? this.defaultChainId
    const provider = await this.getProvider(cid)
    if (!provider) throw new Error(`Provider not available for network ${cid}`)

    return isWalletDeployed(this.address, provider)
  }

  connect(provider: Provider): AbstractSigner {
    throw new Error('Method not implemented.')
  }

  async signTransaction(_transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in Account, please use signTransactions(...)')
  }

  async updateConfig(
    newConfig: WalletConfig,
    chainId: ChainIdLike,
    extraChainIds?: ChainIdLike[],
    callback?: SignedTransactionsCallback
  ): Promise<void> {
    const sessionUtilsInterface = new Interface(walletContracts.sessionUtils.abi)
    const sessionNonce = encodeNonce(SESSIONS_SPACE, 0)

    const transactions: Transaction[] = []

    // Get latest configuration
    const lastConfig = await this.getWalletConfig(chainId)
    if (!lastConfig) throw new Error(`No wallet config found for chainId ${chainId}`)

    // Get transaction update from wallet
    const wallet = new Wallet({ config: lastConfig, context: this._context, strict: false }, ...this._signers)

    const provider = await this.getProvider(getChainId(chainId))
    if (!provider) throw new Error(`Provider not available for network ${chainId}`)

    const newImageHash = imageHash(newConfig)
    const updateBundle = await wallet.setProvider(provider).buildUpdateConfig(newImageHash)
    transactions.push(...updateBundle.transactions)

    // Append session utils requireGapNonce (session nonce)

    // TODO: We should check the browser timestamp before using it as session nonce
    // otherwise if the user changes the time, the session nonce could become corrupt
    const timestamp = ethers.BigNumber.from(Math.floor(Date.now()))

    transactions.push({
      delegateCall: true,
      revertOnError: true,
      gasLimit: ethers.constants.Zero,
      to: this._context.sessionUtils,
      value: ethers.constants.Zero,
      data: sessionUtilsInterface.encodeFunctionData(sessionUtilsInterface.getFunction('requireSessionNonce'), [timestamp]),
      nonce: sessionNonce
    })

    const signed = await wallet.signTransactions(transactions, chainId, true)
    const signatures = [signed]

    // Now sign the updateConfig transaction for all other chains
    // but using the reference configuration
    if (extraChainIds) {
      for (const cid of extraChainIds) {
        const wallet = new Wallet({ config: lastConfig, context: this._context, strict: false }, ...this._signers)
        const signed = await wallet.signTransactions(transactions, cid, true)

        signatures.push(signed)
      }
    }

    // Save new config and counter-factual address
    await this.options.configTracker.saveWalletConfig({ config: newConfig })
    await this.options.configTracker.saveCounterFactualWallet({ context: this._context, imageHash: newImageHash })

    // Send presgigned transactions to config tracker
    // new config should be ready now!
    await this.options.configTracker.savePresignedConfiguration({
      wallet: this.address,
      config: newConfig,
      tx: {
        wallet: this.address,
        tx: packMetaTransactionsData(transactions),
        newImageHash: imageHash(newConfig),
        nonce: sessionNonce,
        gapNonce: timestamp,
      },
      signatures: await Promise.all(signatures.map(async (s) => ({ signature: encodeSignature(await s.signature), chainId: s.chainId })))
    })

    // Safety check, does the config tracker have the new config?
    const newConfigFromTracker = await this.options.configTracker.loadPresignedConfiguration({
      wallet: this.address,
      fromImageHash: imageHash(lastConfig),
      chainId: getChainId(chainId)
    })
    if (newConfigFromTracker.length === 0) {
      throw new Error(`New config not found in config tracker: ${getChainId(chainId)}`)
    }

    const lastImageHashFromTracker = newConfigFromTracker[newConfigFromTracker.length - 1].body.newImageHash
    if (lastImageHashFromTracker !== newImageHash) {
      throw new Error(`Error storing presigned transactions on config tracker. Last image hash ${lastImageHashFromTracker} does not match expected ${newImageHash}`)
    }

    // Config tracker should also known the configuration of the new imageHash
    const configFromTracker = await this.options.configTracker.configOfImageHash({ imageHash: newImageHash })
    if (!configFromTracker || imageHash(configFromTracker) !== newImageHash) {
      throw new Error(`Error configuration of new image hash. Config for image hash ${newImageHash} not found`)
    }
  }

  async isImplementationUpdated(chainId: ChainIdLike): Promise<boolean> {
    const cid = maybeChainId(chainId) ?? this.defaultChainId
    const provider = await this.getProvider(cid)
    if (!provider) throw new Error(`Provider not available for network ${cid}`)

    // We only use this imageHash to know if we have a pending presigned transaction
    // that updates the wallet implementation, nothing more

    // TODO: wallet.implementation() can be evaluated before fetching the imageHash
    const settledImageHash = await fetchImageHash(this.address, provider, { context: this._context, tracker: this.options.configTracker })
    if (!settledImageHash) throw new Error(`No imageHash found for wallet ${this.address}`)

    const presignedTransactions = this.options.configTracker.loadPresignedConfiguration({
      wallet: this.address,
      chainId: getChainId(chainId),
      fromImageHash: settledImageHash,
    })

    const implementation = await getImplementation(this.address, provider)

    return (
      implementation === this._context.mainModuleUpgradable ||
      hasImplementationUpdate(await presignedTransactions, this.address, this._context.mainModuleUpgradable)
    )
  }

  async hasEnoughSigners(chainId: ChainIdLike): Promise<boolean> {
    return (await this._getWallet(chainId))?.hasEnoughSigners() ?? false
  }
}

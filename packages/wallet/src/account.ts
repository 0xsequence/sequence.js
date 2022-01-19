import { TransactionResponse, JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, BytesLike, ethers } from 'ethers'
import { Interface } from "ethers/lib/utils"
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Deferrable } from '@ethersproject/properties'
import { Signer } from './signer'
import { Transactionish, Transaction, TransactionRequest, unpackMetaTransactionData, sequenceTxAbiEncode, SignedTransactionBundle, TransactionBundle, encodeBundleExecData } from '@0xsequence/transactions'
import { WalletConfig, WalletState, ConfigTracker, imageHash } from '@0xsequence/config'
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
import { Relayer } from '@0xsequence/relayer'
import { fetchImageHash } from '.'
import { walletContracts } from '@0xsequence/abi'
import { PresignedConfigUpdate } from '@0xsequence/config/src/tracker/config-tracker'

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

  private _wallets: {
    wallet: Wallet
    network: NetworkConfig
  }[]

  private _context: WalletContext
  private _networks: NetworkConfig[]
  private _signers: (BytesLike | AbstractSigner)[]

  // provider points at the main chain for compatability with the Signer.
  // Use getProvider(chainId) to get the provider for the respective network.
  provider: JsonRpcProvider

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

  private _getWallet(chainId?: ChainIdLike): Wallet | undefined {
    if (!chainId) return undefined
    const cid = getChainId(chainId)
    return this._wallets.find((w) => w.network.chainId === cid)?.wallet
  }

  get defaultChainId(): number {
    return this._networks.find((n) => n.isDefaultChain)?.chainId || this._networks[0].chainId
  }

  get address(): string {
    return this.options.address
  }

  async getAddress(): Promise<string> {
    return this.options.address
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    return this._networks
  }

  async getWalletContext(): Promise<WalletContext> {
    return this._context
  }

  async getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    return this._getWallet(chainId)?.getProvider()
  }

  async getRelayer(chainId?: number): Promise<Relayer | undefined> {
    return this._getWallet(chainId)?.getRelayer()
  }

  // Return the highest lazy configuration available for the given chainId
  async getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig | undefined> {
    // Get latest config for wallet using the config tracker
    const cid = maybeChainId(chainId) || this.defaultChainId

    const wallet = this._getWallet(cid)
    if (!wallet) throw new Error(`No wallet found for chainId ${cid}`)

    // Get latest imageHash for wallet
    // if not available then we can't get the latest walletConfig either
    const imageHash = await fetchImageHash(wallet, { context: this._context, tracker: this.options.configTracker })
    if (!imageHash) return undefined

    const config = await this.options.configTracker.loadPresignedConfiguration({
      wallet: this.address,
      chainId: cid,
      fromImageHash: imageHash,
    })

    // If no pending presigned configuration
    // then the current imageHash is the latest config
    // and in that case we just need to fetch the config for it
    if (!config || config.length === 0) {
      return this.options.configTracker.configOfImageHash({ imageHash })
    }

    // If there are pending presigned configurations
    // then we take the imageHash of the last step, and map it to a config
    return this.options.configTracker.configOfImageHash({ imageHash: config[config.length - 1].body.newImageHash })
  }

  async getWalletState(chainId?: ChainIdLike): Promise<WalletState> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId
    const wallet = this._getWallet(cid)
    if (!wallet) throw new Error(`No wallet found for chainId ${cid}`)

    // TODO: The following the promises can be solved by using a Promise.all
    
    // Is the wallet deployed?
    const deployed = await wallet.isDeployed()

    // Get imageHash of wallet, this is the current imageHash on the actual chain
    // we only use it to know if the wallet is up to date or not on the chain
    const settledImageHash = await fetchImageHash(wallet, { context: this._context, tracker: this.options.configTracker })

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

  async decorateTransactions(bundle: TransactionBundle, chainId?: ChainIdLike): Promise<TransactionBundle> {
    // Get wallet of network
    const cid = maybeChainId(chainId) || this.defaultChainId
    const wallet = this._getWallet(cid)
    if (!wallet) throw new Error(`No wallet found for chainId ${cid}`)

    // Get wallet state for network
    const state = await this.getWalletState(chainId)

    // If wallet is published and deployed, then we can just send the transactions as-is
    if (state.published && state.deployed) {
      return bundle
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
      // TODO: We are fetching the presigned transactions twice
      // it should be better to not use `getWalletState` and instead fetch that info directly
      // so we don't need to do it twice
      const settledImageHash = await fetchImageHash(wallet, { context: this._context, tracker: this.options.configTracker })
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

    // Append execution of original bundle
    const data = encodeBundleExecData(bundle)
    guestTxs.push({
      to: this.address,
      data: data,
      gasLimit: 0,
      delegateCall: false,
      revertOnError: true,
      value: 0
    })

    // If guestModule is not defined
    // then we can't decorate the transactions like this
    const guestModule = this._context.guestModule
    if (!guestModule) {
      throw new Error('Error decorating transactions - Guest module is not defined')
    }

    return {
      intent: bundle.intent,
      entrypoint: guestModule,
      transactions: guestTxs,
      chainId: ethers.BigNumber.from(cid),
    }
  }

  async signMessage(message: BytesLike, chainId?: ChainIdLike, allSigners?: boolean, isDigest?: boolean): Promise<string> {
    const wallet = this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    return wallet.signMessage(message, chainId, allSigners, isDigest)
  }

  signTypedData(domain: TypedDataDomain, types: Record<string, TypedDataField[]>, message: Record<string, any>, chainId?: ChainIdLike, allSigners?: boolean): Promise<string> {
    const wallet = this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    // TODO: Append presigned update to signature
    // that way validation can validate it without querying sequence-sesions
    return wallet.signTypedData(domain, types, message, chainId, allSigners)
  }

  sendTransactionBatch(transactions: Deferrable<TransactionRequest[] | Transaction[]>, chainId?: ChainIdLike, allSigners?: boolean): Promise<TransactionResponse> {
    return this.sendTransaction(transactions, chainId, allSigners)
  }

  async sendTransaction(transaction: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners?: boolean): Promise<TransactionResponse> {
    // Sign and send transactions using internal methods
    // these internal methods will decorate the transactions before relaying them
    // decoration appens wallet deployment or presigned wallet update
    const signed = await this.signTransactions(transaction, chainId, allSigners)
    return this.sendSignedTransactions(signed, chainId)
  }

  async signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners?: boolean): Promise<SignedTransactionBundle> {
    const wallet = this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    const signed = await wallet.signTransactions(txs, chainId, allSigners)
    const decorated = await this.decorateTransactions(signed, chainId)

    // TODO add nonce and signature to comply with SignedTransactionBundle
    // maybe we need to add a new type for GuestTransactionBundle and maybe details
    // about the original intent being signed or not
    return { ...decorated, nonce: ethers.constants.Zero, signature: "" }
  }

  sendSignedTransactions(signedBundle: SignedTransactionBundle, chainId?: ChainIdLike): Promise<TransactionResponse> {
    const wallet = this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    return wallet.relayer.relay(signedBundle)
  }

  isDeployed(chainId?: ChainIdLike): Promise<boolean> {
    const wallet = this._getWallet(chainId)
    if (!wallet) throw new Error(`No wallet found for chainId ${chainId}`)
    return wallet.isDeployed(chainId)
  }

  connect(provider: Provider): AbstractSigner {
    throw new Error('Method not implemented.')
  }

  async signTransaction(_transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in Account, please use signTransactions(...)')
  }

  // useSigners(...signers: (BytesLike | AbstractSigner)[]): Account {
  //   this._signers = signers
  //   this._wallets.forEach(w => {
  //     w.wallet = w.wallet.useSigners(...signers)
  //   })
  //   return this
  // }

  // async getWalletContext(): Promise<WalletContext> {
  //   return this.options.context!
  // }

  // getConfigFinder(): ConfigFinder {
  //   if (this.options.configFinder) return this.options.configFinder
  //   return new SequenceUtilsFinder(this.authWallet().wallet.provider)
  // }

  // // getWalletConfig builds a list of WalletConfigs across all networks.
  // // This is useful to shows all keys/devices connected to a wallet across networks.
  // async getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig[]> {
  //   let wallets: { wallet: Wallet; network: NetworkConfig }[] = []
  //   if (chainId) {
  //     const v = this.getWalletByNetwork(chainId)
  //     if (v) {
  //       wallets.push(v)
  //     }
  //   } else {
  //     wallets = this._wallets
  //   }
  //   return (await Promise.all(wallets.map(w => w.wallet.getWalletConfig()))).flat()
  // }

  // async getWalletState(chainId?: ChainIdLike): Promise<WalletState[]> {
  //   let wallets: { wallet: Wallet; network: NetworkConfig }[] = []
  //   if (chainId) {
  //     const v = this.getWalletByNetwork(chainId)
  //     if (v) {
  //       wallets.push(v)
  //     }
  //   } else {
  //     wallets = this._wallets
  //   }

  //   const configsPromise = Promise.all(
  //     wallets.map(w =>
  //       this.getConfigFinder().findCurrentConfig({
  //         address: w.wallet.address,
  //         provider: w.wallet.provider,
  //         context: w.wallet.context,
  //         knownConfigs: [w.wallet.config]
  //       })
  //     )
  //   )

  //   const states = (await Promise.all(wallets.map(w => w.wallet.getWalletState()))).flat()

  //   // fetch the current config for the AuthChain, as it will be available
  //   const idx = states.findIndex(s => s.chainId === this.getAuthChainId())
  //   if (idx >= 0) {
  //     states[idx].config = await this.currentConfig(wallets[idx].wallet)
  //   }

  //   const configs = await configsPromise

  //   return states.map((s, i) => ({
  //     ...s,
  //     config: configs[i]?.config
  //   }))
  // }

  // // address getter
  // get address(): string {
  //   return this._wallets[0].wallet.address
  // }

  // // getAddress returns the address of the wallet -- note the account address is the same
  // // across all wallets on all different networks
  // getAddress(): Promise<string> {
  //   return this._wallets[0].wallet.getAddress()
  // }

  // // getSigners returns the multi-sig signers with permission to control the wallet
  // async getSigners(): Promise<string[]> {
  //   return this._wallets[0].wallet.getSigners()
  // }

  // async getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
  //   if (!chainId) return this.mainWallet()?.wallet.getProvider()
  //   return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getProvider()
  // }

  // async getRelayer(chainId?: number): Promise<Relayer | undefined> {
  //   if (!chainId) return this.mainWallet()?.wallet.getRelayer()
  //   return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getRelayer()
  // }

  // async getNetworks(): Promise<NetworkConfig[]> {
  //   return this.options.networks!
  // }

  // // NOTE: this is copied over on top of ethers, and is memoized
  // async getChainId(): Promise<number> {
  //   if (this._chainId) return this._chainId
  //   const network = await this.provider.getNetwork()
  //   this._chainId = network.chainId
  //   return this._chainId
  // }

  // getAuthChainId(): number {
  //   let n = this.options.networks![0]
  //   if (n.isAuthChain) return n.chainId
  //   n = this.options.networks![1]
  //   if (n.isAuthChain) return n.chainId
  //   throw new Error('expecting authChain to be the first or second in networks list')
  // }

  // async signMessage(
  //   message: BytesLike,
  //   target?: Wallet | ChainIdLike,
  //   allSigners: boolean = true,
  //   isDigest: boolean = false
  // ): Promise<string> {
  //   let { wallet } = await (async () => {
  //     // eslint-disable-line
  //     if (!target) {
  //       return this.mainWallet()
  //     }
  //     if ((<Wallet>target).address) {
  //       const chainId = await (<Wallet>target).getChainId()
  //       return this.getWalletByNetwork(chainId)
  //     }
  //     return this.getWalletByNetwork(target as ChainIdLike)
  //   })()

  //   // Fetch the latest config of the wallet.
  //   //
  //   // We skip this step if wallet is authWallet. The assumption is that authWallet
  //   // will already have the latest config, but lets confirm that.
  //   // TODO: instead, memoize the currentConfig, as below will break
  //   // if we skip
  //   // if (!network.isAuthChain) {
  //   let thisConfig = await this.currentConfig(wallet)
  //   thisConfig = thisConfig ? thisConfig : this._wallets[0].wallet.config
  //   wallet = wallet.useConfig(thisConfig)
  //   // }

  //   // See if wallet and available signers set has enough signer power,
  //   // but if allSigners is false, we allow partial signing
  //   const weight = await wallet.signWeight()
  //   if (weight.lt(wallet.config.threshold) && allSigners !== false) {
  //     throw new NotEnoughSigners(
  //       `Sign message - wallet combined weight ${weight.toString()} below required ${wallet.config.threshold.toString()}`
  //     )
  //   }

  //   return wallet.signMessage(message, undefined, allSigners, isDigest)
  // }

  // // TODO: should allSigners default to false here..?
  // async signAuthMessage(message: BytesLike, allSigners: boolean = true, isDigest: boolean = false): Promise<string> {
  //   return this.signMessage(message, this.authWallet()?.wallet, allSigners, isDigest)
  // }

  // async signTypedData(
  //   domain: TypedDataDomain,
  //   types: Record<string, Array<TypedDataField>>,
  //   message: Record<string, any>,
  //   chainId?: ChainIdLike,
  //   allSigners: boolean = true
  // ): Promise<string> {
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
  //   const digest = encodeTypedDataDigest({ domain, types, message })
  //   return this.signMessage(digest, wallet, allSigners, true)
  // }

  // async _signTypedData(
  //   domain: TypedDataDomain,
  //   types: Record<string, Array<TypedDataField>>,
  //   message: Record<string, any>,
  //   chainId?: ChainIdLike,
  //   allSigners: boolean = true
  // ): Promise<string> {
  //   return this.signTypedData(domain, types, message, chainId, allSigners)
  // }

  // async hasEnoughSigners(chainId?: ChainIdLike): Promise<boolean> {
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
  //   const thisConfig = await this.currentConfig(wallet)
  //   return wallet.useConfig(thisConfig!).hasEnoughSigners()
  // }

  // async getFeeOptions(transaction: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners: boolean = true): Promise<FeeOption[]> {
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet

  //   const context = this.options.context
  //   if (!context) {
  //     throw new Error(`missing wallet context`)
  //   }

  //   // TODO: can we avoid calling `this.currentConfig(wallet)` everytime here.. this is an expensive
  //   // operations and we shouldn't be doing it so liberally. What is the minimum information we require here..?
  //   // and what is the config used for, and how can we optimize..?

  //   // TODO: prependConfigUpdate also looks like its calling currentConfig() again, so we're doubling this.

  //   // A few thoughts.. first off, we must add some kind of memoization for this, but with great care, because
  //   // the config might change. This make me think we need some king of "ConfigSource" class, or "ConfigXXX" (name?),
  //   // which we can ask to give us a wallet config. This config would also be used when we update/change a config,
  //   // such that it can memoize, but also since its the sole interface, it will also properly expire or update the config
  //   // in cache as necessary. Further to this, I think we need to only get config details for what is required, and try
  //   // to optimize by using imageHashes of the config everywhere, as this is a much more inexpensive value to fetch.

  //   const [
  //     config,
  //     updatedTransaction
  //   ] = await Promise.all([
  //     this.currentConfig(wallet),
  //     this.prependConfigUpdate(transaction, chainId, allSigners, true)
  //   ])
  //   if (!config) {
  //     throw new Error(`missing current config for chain ${chainId}`)
  //   }

  //   const finalTransactions = await fromTransactionish(context, this.address, updatedTransaction)
  //   return wallet.relayer.gasRefundOptions(config, context, ...finalTransactions)
  // }

  // async sendTransaction(
  //   dtransactionish: Deferrable<Transactionish>,
  //   chainId?: ChainIdLike,
  //   allSigners: boolean = true,
  //   callback?: SignedTransactionsCallback
  // ): Promise<TransactionResponse> {
  //   const signedTxs = await this.signTransactions(dtransactionish, chainId, allSigners)

  //   if (callback) {
  //     const address = addressOf(signedTxs.config, signedTxs.context)
  //     const metaTxnHash = computeMetaTxnHash(address, signedTxs.chainId, ...signedTxs.transactions)
  //     callback(signedTxs, metaTxnHash)
  //   }

  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
  //   return wallet.sendSignedTransactions(signedTxs, chainId)
  // }

  // async sendTransactionBatch(
  //   transactions: Deferrable<TransactionRequest[] | Transaction[]>,
  //   chainId?: ChainIdLike,
  //   allSigners: boolean = true,
  //   callback?: SignedTransactionsCallback
  // ): Promise<TransactionResponse> {
  //   return this.sendTransaction(transactions, chainId, allSigners, callback)
  // }

  // async signTransactions(dtransactionish: Deferrable<Transactionish>, chainId?: ChainIdLike, allSigners?: boolean): Promise<SignedTransactions> {
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
  //   let currentConfig = await this.currentConfig(wallet)

  //   if (!currentConfig) {
  //     currentConfig = await this.currentConfig()
  //     if (!currentConfig) {
  //       throw new Error('missing auth chain config')
  //     }
  //   }

  //   const transactions = await this.prependConfigUpdate(dtransactionish, chainId, allSigners)
  //   return wallet.useConfig(currentConfig).signTransactions(transactions)
  // }

  // async prependConfigUpdate(
  //   dtransactionish: Deferrable<Transactionish>,
  //   chainId?: ChainIdLike,
  //   allSigners?: boolean,
  //   skipThresholdCheck?: boolean
  // ): Promise<Transactionish> {
  //   const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet

  //   // TODO: Skip this step if wallet is authWallet
  //   const [thisConfig, lastConfig] = await Promise.all([this.currentConfig(wallet), this.currentConfig()])

  //   // We have to skip the threshold check during fee estimation because we
  //   // might not have the necessary signers until the wallet actually signs the
  //   // transactions.
  //   //
  //   // By design, the Torus login key only exists in memory in Sequence wallet
  //   // and cannot generally be assumed to be available. However the Torus login
  //   // key might be required in order to transact on other non-auth chains,
  //   // because the wallet config might not recognize the current session's
  //   // signing key. In these cases, the Torus key is retrieved when the user
  //   // confirms the transaction, which happens after fee estimation. So the
  //   // wallet might not meet the threshold during fee estimation despite
  //   // meeting it at confirmation time.
  //   if (!skipThresholdCheck) {
  //     // See if wallet has enough signer power
  //     const weight = await wallet.useConfig(thisConfig!).signWeight()
  //     if (weight.lt(thisConfig!.threshold) && allSigners) {
  //       throw new NotEnoughSigners(
  //         `wallet combined weight ${weight.toString()} below required threshold ${thisConfig!.threshold.toString()}`
  //       )
  //     }
  //   }

  //   // If the wallet is updated, just sign as-is
  //   if (await wallet.isDeployed() && isConfigEqual(lastConfig!, thisConfig!)) {
  //     return transaction
  //   }

  //   // Bundle with configuration update
  //   const transactionParts = (() => {
  //     if (Array.isArray(transaction)) {
  //       return transaction
  //     } else {
  //       return [transaction]
  //     }
  //   })()

  //   return [...(await wallet.buildUpdateConfigTransaction(lastConfig!, false)), ...transactionParts]
  // }

  // async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainIdLike): Promise<TransactionResponse> {
  //   const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
  //   return wallet.sendSignedTransactions(signedTxs)
  // }

  // // updateConfig will build an updated config transaction, update the imageHash on-chain and also publish
  // // the wallet config to the authChain. Other chains are lazy-updated on-demand as batched transactions.
  // async updateConfig(
  //   newConfig?: WalletConfig,
  //   index?: boolean,
  //   callback?: SignedTransactionsCallback
  // ): Promise<[WalletConfig, TransactionResponse | undefined]> {
  //   const authWallet = this.authWallet().wallet

  //   if (!newConfig) {
  //     newConfig = authWallet.config
  //   } else {
  //     // ensure its normalized
  //     newConfig = sortConfig(newConfig)
  //   }

  //   // The config is the default config, see if the wallet has been deployed
  //   if (isConfigEqual(authWallet.config, newConfig)) {
  //     if (!(await this.isDeployed())) {
  //       // Deploy the wallet and publish initial configuration
  //       return await authWallet.updateConfig(newConfig, undefined, true, index, callback)
  //     }
  //   }

  //   // Get latest config, update only if neccesary
  //   const lastConfig = await this.currentConfig()
  //   if (isConfigEqual(lastConfig!, newConfig)) {
  //     return [
  //       {
  //         ...lastConfig!,
  //         address: this.address
  //       },
  //       undefined
  //     ]
  //   }

  //   // Update to new configuration on the authWallet. Other networks will be lazily updated
  //   // once used. The wallet config is also auto-published to the authChain.
  //   const [_, tx] = await authWallet.useConfig(lastConfig!).updateConfig(newConfig, undefined, true, index, callback)

  //   return [
  //     {
  //       ...newConfig,
  //       address: this.address
  //     },
  //     tx
  //   ]
  // }

  // // publishConfig will publish the wallet config to the network via the relayer. Publishing
  // // the config will also store the entire object of signers.
  // publishConfig(
  //   indexed?: boolean,
  //   requireFreshSigners: string[] = [],
  //   callback?: SignedTransactionsCallback
  // ): Promise<TransactionResponse> {
  //   return this.authWallet().wallet.publishConfig(indexed, undefined, requireFreshSigners, callback)
  // }

  // async isDeployed(target?: Wallet | ChainIdLike): Promise<boolean> {
  //   const wallet = (() => {
  //     if (!target) return this.authWallet().wallet
  //     if ((<Wallet>target).address) {
  //       return target as Wallet
  //     }
  //     return this.getWalletByNetwork(target as NetworkConfig).wallet
  //   })()
  //   return wallet.isDeployed()
  // }

  // // TODO: Split this to it's own class "configProvider" or something
  // // this process can be done in different ways (caching, api, utils, etc)
  // async currentConfig(target?: Wallet | NetworkConfig): Promise<WalletConfig | undefined> {
  //   const wallet = (() => {
  //     if (!target) return this.authWallet().wallet
  //     if ((<Wallet>target).address) {
  //       return target as Wallet
  //     }
  //     return this.getWalletByNetwork(target as NetworkConfig).wallet
  //   })()

  //   return (
  //     await this.getConfigFinder().findCurrentConfig({
  //       address: this.address,
  //       provider: wallet.provider,
  //       context: wallet.context,
  //       knownConfigs: [wallet.config]
  //     })
  //   ).config
  // }

  // getWallets(): { wallet: Wallet; network: NetworkConfig }[] {
  //   return this._wallets
  // }

  // getWalletByNetwork(chainId: ChainIdLike) {
  //   const networkId = getChainId(chainId)
  //   const network = this._wallets.find(w => w.network.chainId === networkId)
  //   if (!network) {
  //     throw new Error(`network ${chainId} not found in wallets list`)
  //   }
  //   return network
  // }

  // // mainWallet is the DefaultChain wallet
  // mainWallet(): { wallet: Wallet; network: NetworkConfig } {
  //   const found = this._wallets.find(w => w.network.isDefaultChain)
  //   if (!found) {
  //     throw new Error('mainWallet not found')
  //   }
  //   return found
  // }

  // // authWallet is the AuthChain wallet
  // authWallet(): { wallet: Wallet; network: NetworkConfig } {
  //   const found = this._wallets.find(w => w.network.isAuthChain)
  //   if (!found) {
  //     throw new Error('authChain wallet not found')
  //   }
  //   return found
  // }

  // setNetworks(mainnetNetworks: Networks, testnetNetworks: Networks = [], defaultChainId?: string | number): number {
  //   let networks: Networks = []
  //   this._chainId = undefined // clear memoized value

  //   // force-convert to a number in case someone sends a number in a string like "1"
  //   const defaultChainIdNum = parseInt(defaultChainId as any)

  //   // find chain between mainnet and testnet network groups, and set that network group.
  //   // otherwise use mainnetNetworks without changes
  //   if (testnetNetworks && testnetNetworks.length > 0 && defaultChainId) {
  //     const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
  //     if (mainnetNetwork) {
  //       mainnetNetwork.isDefaultChain = true
  //       networks = mainnetNetworks
  //     } else {
  //       const testnetNetwork = testnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
  //       if (testnetNetwork) {
  //         testnetNetwork.isDefaultChain = true
  //         networks = testnetNetworks
  //       }
  //     }
  //   } else if (mainnetNetworks && mainnetNetworks.length > 0 && defaultChainId) {
  //     const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
  //     if (mainnetNetwork) {
  //       mainnetNetwork.isDefaultChain = true
  //       networks = mainnetNetworks
  //     }
  //   } else {
  //     networks = mainnetNetworks
  //   }

  //   // assign while validating network list
  //   this.options.networks = ensureValidNetworks(sortNetworks(networks, defaultChainId))

  //   // Account/wallet instances using the initial configuration and network list
  //   //
  //   // TODO: we can make an optimization where if mainnetNetworks and testnetNetworks lists
  //   // haven't changed between calls, and only the defaultChainId, as well, the group between
  //   // mainnet vs testnet has not changed either -- aka just defaultChainId within a group,
  //   // then we can avoid rebuilding all of these objects and instead just sort them
  //   this._wallets = this.options.networks.map(network => {
  //     const wallet = new Wallet(
  //       {
  //         config: this.options.initialConfig,
  //         context: this.options.context
  //       },
  //       ...this._signers
  //     )

  //     if (network.provider) {
  //       wallet.setProvider(network.provider)
  //     } else if (network.rpcUrl && network.rpcUrl !== '') {
  //       wallet.setProvider(network.rpcUrl)
  //     } else {
  //       throw new Error(`network config is missing provider settings for chainId ${network.chainId}`)
  //     }

  //     if (isRelayer(network.relayer)) {
  //       wallet.setRelayer(network.relayer)
  //     } else if (isRpcRelayerOptions(network.relayer)) {
  //       wallet.setRelayer(new RpcRelayer({ provider: wallet.provider, ...network.relayer }))
  //     } else {
  //       throw new Error(`network config is missing relayer settings for chainId ${network.chainId}`)
  //     }

  //     if (network.isDefaultChain) {
  //       this._chainId = network.chainId
  //       this.provider = wallet.provider
  //     }
  //     return {
  //       network: network,
  //       wallet: wallet
  //     }
  //   })

  //   // return the default chain id as number
  //   return this.options.networks[0].chainId
  // }

  // connect(_: Provider): AbstractSigner {
  //   throw new Error('connect method is not supported in MultiWallet')
  // }

  // signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
  //   throw new Error('signTransaction method is not supported in MultiWallet, please use signTransactions(...)')
  // }
}

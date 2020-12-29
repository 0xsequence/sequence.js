import { TransactionResponse, TransactionRequest, JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, Contract, ethers, BytesLike, BigNumberish } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import { walletContracts } from '@0xsequence/abi'
import { Signer, NotEnoughSigners } from './signer'
import { SignedTransactions, Transactionish } from '@0xsequence/transactions'
import { WalletConfig, addressOf, imageHash, isConfigEqual } from './config'
import { ChainId, NetworkConfig, WalletContext, sequenceContext, isNetworkConfig } from '@0xsequence/network'
import { Wallet } from './wallet'
import { resolveArrayProperties } from './utils'
import { Relayer } from '@0xsequence/relayer'

export type MultiWalletOptions = {
  initConfig: WalletConfig, // TODO: init config..? hmm.. how about in Wallet?
  networks: NetworkConfig[],
  signers: AbstractSigner[], // TODO: move this up like with Wallet()? ..? maybe.
  context?: WalletContext
}

export class MultiWallet extends Signer {
  private readonly options: MultiWalletOptions

  private readonly _wallets: {
    wallet: Wallet,
    network: NetworkConfig // hmm.. network config here..? why..
  }[]

  constructor(opts: MultiWalletOptions) {
    super()

    // TODO: also set default networks here..
    if (opts.networks.length === 0) throw new Error('MultiWallet constructor options must provide networks')

    // Use deployed wallet context by default if not provided
    if (!opts.context) opts.context = sequenceContext

    // Account/wallet instances using the initial configuration
    // TODO: integrity check, ensure networks doesn't have same chainId twice..
    // prob add as helper method on 0xsequence/network

    // TODO: review... add setNetworkConfig ..? or setNetwork(NetworkConfig) ..?
    this._wallets = opts.networks.map((network) => {
      const wallet = new Wallet({ config: opts.initConfig, context: opts.context }, ...opts.signers)
      wallet.setProvider(network.rpcUrl)
      if (network.relayer) {
        wallet.setRelayer(network.relayer)
      }
      return {
        network: network,
        wallet: wallet
      }
    })

    this.options = opts
  }

  getWalletContext(): WalletContext {
    return this.options.context
  }

  // address getter
  get address(): string {
    return this._wallets[0].wallet.address
  }

  // getAddress returns the address of the wallet -- note the account address is the same
  // across all wallets on all different networks
  getAddress(): Promise<string> {
    return this._wallets[0].wallet.getAddress()
  }

  // getSigners returns the multi-sig signers with permission to control the wallet
  async getSigners(): Promise<string[]> {
    return this._wallets[0].wallet.getSigners()
  }

  getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    if (chainId === undefined) return this.mainWallet().getProvider()
    return this._wallets.find((w) => w.network.chainId === chainId)?.wallet.getProvider()
  }

  getRelayer(chainId?: number): Promise<Relayer | undefined> {
    if (chainId === undefined) return this.mainWallet().getRelayer()
    return this._wallets.find((w) => w.network.chainId === chainId)?.wallet.getRelayer()
  }

  async getNetworks(): Promise<number[]> {
    return this.options.networks.map(n => n.chainId)
  }

  // getWalletConfig builds a list of WalletConfigs across all networks.
  // This is useful to shows all keys/devices connected to a wallet across networks.
  // Sorted by: mainChain, authChain, ...rest by ascending numerical order of network's chainId
  // TODO: or just sort by chainId ascending order..?
  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> { // TODO: type? include Network..? might be helpful.
    // const allConfigs = await Promise.all(this._wallets.map(async (w) => ({ wallet: w, config: await this.currentConfig(w.wallet) })))
    // return allConfigs

    // TODO: ordering..? primary, etc..

    // TODO: only return walletconfig for specific network..

    const chainIdNum = (() => {
      if (!chainId) {
        return undefined
      }
      if ((<NetworkConfig>chainId).chainId) {
        return ((<NetworkConfig>chainId)).chainId
      }
      return ethers.BigNumber.from(chainId as BigNumberish).toNumber()
    })()


    // TODO: confirm map() doesn't returned elements with undefined

    return Promise.all(this._wallets.map(async w => {
      const walletConfig = await w.wallet.getWalletConfig()
      if (!chainId || walletConfig[0].chainId === chainIdNum) {
        return walletConfig[0]
      }
    }))

    // const thresholds = allConfigs.map((c) => ({ chaind: c.wallet.network.chainId, weight: c.config.threshold }))
    // const allSigners = allConfigs.reduce((p, config) => {
    //   config.config.signers.forEach((signer) => {
    //     const item = p.find((c) => c.address === signer.address)
    //     const netEntry = {
    //       weight: signer.weight,
    //       chaind: config.wallet.network.chainId
    //     }

    //     if (!item) {
    //       p.push({
    //         address: signer.address,
    //         networks: [netEntry]
    //       })
    //     } else {
    //       item.networks.push(netEntry)
    //     }
    //   })
    //   return p
    // })

    // return {
    //   threshold: thresholds,
    //   signers: allSigners
    // }
  }

  async signAuthMessage(message: BytesLike, allSigners: boolean = true): Promise<string> {
    return this.signMessage(message, this.authWallet(), allSigners)
  }

  async signMessage(message: BytesLike, target?: Wallet | ChainId, allSigners: boolean = true): Promise<string> {
    const wallet = (() => {
      if (!target) return this.mainWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig)
    })()

    // TODO: Skip this step if wallet is authWallet
    let thisConfig = await this.currentConfig(wallet)
    thisConfig = thisConfig ? thisConfig : this._wallets[0].wallet.config

    // TODO: review..
    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && allSigners) {
      throw new NotEnoughSigners(`Sign message - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    // TODO .. ugh..
    return wallet.useConfig(thisConfig).signMessage(message)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, chainId?: ChainId, allSigners: boolean = true): Promise<TransactionResponse> {
    const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
    const wallet = chainId ? this.getWalletByNetwork(chainId) : this.mainWallet()

    // TODO: Skip this step if wallet is authWallet
    const [thisConfig, lastConfig] = await Promise.all([
      this.currentConfig(wallet), this.currentConfig()
    ])

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && allSigners) {
      throw new NotEnoughSigners(`sendTransaction(), wallet combined weight ${weight.toString()} below required threshold ${thisConfig.threshold.toString()}`)
    }

    // If the wallet is updated, procede to transaction send
    if (isConfigEqual(lastConfig, thisConfig)) {
      return wallet.useConfig(lastConfig).sendTransaction(transaction)
    }

    // Bundle with configuration update
    const transactionParts = (() => {
      if (Array.isArray(transaction)) {
        return transaction
      } else {
        return [transaction]
      }
    })()

    return wallet.useConfig(thisConfig).sendTransaction([
      ...await wallet.buildUpdateConfigTransaction(lastConfig, false),
      ...transactionParts
    ])
  }

  signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    const wallet = chainId ? this.getWalletByNetwork(chainId) : this.mainWallet()
    return wallet.signTransactions(txs, chainId, allSigners)
  }

  async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    const wallet = chainId ? this.getWalletByNetwork(chainId) : this.mainWallet()
    return wallet.sendSignedTransactions(signedTxs)
  }

  // updateConfig will build an updated config transaction and send/publish it to the auth chain
  // other chains are lazy-updated on the subsequent transactions
  async updateConfig(newConfig: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> {
    // The config is the default config, see if the wallet has been deployed
    if (isConfigEqual(this._wallets[0].wallet.config, newConfig)) {
      if (!(await this.isDeployed())) {
        // Deploy the wallet and publish initial configuration
        return [newConfig, await this.authWallet().publishConfig()]
      }
    }

    // TODO: consolidate this with Wallet .. there is duplicate stuff in here..

    // Get latest config, update only if neccesary
    const lastConfig = await this.currentConfig()
    if (isConfigEqual(lastConfig, newConfig)) {
      return [{
        ...lastConfig,
        address: this.address
      }, undefined]
    }

    // Update to new configuration
    // lazy update all other networks
    const [_, tx] = await this.authWallet()
      .useConfig(lastConfig)
      .updateConfig(newConfig, undefined, true)

    return [{
      ...newConfig,
      address: this.address
    }, tx]
  }

  // publishConfig will publish the wallet config to the network via the relayer. Publishing
  // the config will also store the entire object of signers.
  publishConfig(): Promise<TransactionResponse> {
    return this.authWallet().publishConfig()
  }

  async isDeployed(target?: Wallet | ChainId): Promise<boolean> {
    // TODO: lets check the imageHash.. maybe add arument here..?
    // TODO: can prob also just use method from Wallet() .. this is duplicated again.

    const wallet = (() => {
      if (!target) return this.authWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig)
    })()

    const walletCode = await wallet.provider.getCode(this.address)
    return walletCode && walletCode !== "0x"
  }

  // TODO: move this to Wallet? and then use target above..?

  // TODO: review..
  // TODO: Split this to it's own class "configProvider" or something
  // this process can be done in different ways (caching, api, utils, etc)
  async currentConfig(target?: Wallet | NetworkConfig): Promise<WalletConfig | undefined> {
    const address = this.address
    const wallet = (() => {
      if (!target) return this.authWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig)
    })()
  
    const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, wallet.provider)

    const authWallet = this.authWallet()
    const authContract = new Contract(authWallet.context.requireUtils, walletContracts.requireUtils.abi, authWallet.provider)

    const currentImageHash = walletContract.functions.imageHash.call([])
    currentImageHash.catch(() => {}) // Ignore no imageHash defined
    const currentImplementation = ethers.utils.defaultAbiCoder.decode(
      ['address'], await wallet.provider.getStorageAt(address, address)
    )[0]

    let event: any
    if (currentImplementation === wallet.context.mainModuleUpgradable) {
      // Test if given config is the already updated+published config
      if (imageHash(this._wallets[0].wallet.config) === await currentImageHash) {
        return this._wallets[0].wallet.config
      }

      // The wallet has been updated
      // lookup configuration using imageHash
      const filter = authContract.filters.RequiredConfig(null, await currentImageHash)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter}) // REVIEW, fromBlock: 0 ?
      if (logs.length === 0) return undefined
      const lastLog = logs[logs.length - 1]
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    } else {
      // Test if given config is counter-factual config
      if (addressOf(this._wallets[0].wallet.config, this._wallets[0].wallet.context).toLowerCase() === address.toLowerCase()) {
        return this._wallets[0].wallet.config
      }

      // The wallet it's using the counter-factual configuration
      const filter = authContract.filters.RequiredConfig(address)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
      if (logs.length === 0) return undefined
      const lastLog = logs[0] // TODO: Search for real counter-factual config
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    }

    const signers = ethers.utils.defaultAbiCoder.decode(
      [`tuple(
        uint256 weight,
        address signer
      )[]`], event._signers
    )[0]

    const config = {
      address: address,
      threshold: event._threshold,
      signers: signers.map((s: any) => ({
        address: s.signer,
        weight: s.weight
      }))
    }

    return config
  }

  private mainWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isMainChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  private authWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isAuthChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  private getWalletByNetwork(network: ChainId): Wallet {
    const chainId = (() => {
      if ((<NetworkConfig>network).chainId) {
        return (<NetworkConfig>network).chainId
      }
      return ethers.BigNumber.from(network as BigNumberish).toNumber()
    })()

    return this._wallets.find((w) => w.network.chainId === chainId).wallet
  }

  connect(_: Provider): AbstractSigner {
    throw new Error('connect method is not supported in MultiWallet')
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in MultiWallet, please use signTransactions(...)')
  }
}

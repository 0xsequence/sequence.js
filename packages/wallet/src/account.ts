import { TransactionResponse, TransactionRequest, JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, ethers, BytesLike } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Deferrable } from '@ethersproject/properties'
import { walletContracts } from '@0xsequence/abi'
import { Signer, NotEnoughSigners } from './signer'
import { SignedTransactions, Transactionish } from '@0xsequence/transactions'
import { WalletConfig, WalletState, isConfigEqual, sortConfig, ConfigFinder, SequenceUtilsFinder } from '@0xsequence/config'
import { ChainId, Networks, NetworkConfig, WalletContext, sequenceContext, mainnetNetworks, isNetworkConfig, ensureValidNetworks, sortNetworks, getNetworkId } from '@0xsequence/network'
import { Wallet } from './wallet'
import { resolveArrayProperties, findLatestLog } from './utils'
import { Relayer, RpcRelayer } from '@0xsequence/relayer'
import { encodeTypedDataHash } from '@0xsequence/utils'

export interface AccountOptions {
  initialConfig: WalletConfig
  networks?: NetworkConfig[]
  context?: WalletContext
  configFinder?: ConfigFinder
}

// Account is an interface to a multi-network smart contract wallet.
export class Account extends Signer {
  private readonly options: AccountOptions

  private _wallets: {
    wallet: Wallet,
    network: NetworkConfig
  }[]

  private _signers: (BytesLike | AbstractSigner)[]

  // provider points at the main chain for compatability with the Signer.
  // Use getProvider(chainId) to get the provider for the respective network.
  provider: JsonRpcProvider

  constructor(options: AccountOptions, ...signers: (BytesLike | AbstractSigner)[]) {
    super()

    this.options = options
    this._signers = signers

    // Use deployed wallet context by default if not provided
    if (!options.context) this.options.context = { ...sequenceContext }

    // Network config, defaults will be used if none are provided
    if (this.options.networks) {
      this.setNetworks(this.options.networks)
    } else {
      this.setNetworks([ ...mainnetNetworks ])
    }
  }

  useSigners(...signers: (BytesLike | AbstractSigner)[]): Account {
    this._signers = signers
    this._wallets.forEach(w => {
      w.wallet = w.wallet.useSigners(...signers)
    })
    return this
  }

  async getWalletContext(): Promise<WalletContext> {
    return this.options.context!
  }

  getConfigFinder(): ConfigFinder {
    if (this.options.configFinder) return this.options.configFinder
    return new SequenceUtilsFinder(this.authWallet().wallet.provider)
  }

  // getWalletConfig builds a list of WalletConfigs across all networks.
  // This is useful to shows all keys/devices connected to a wallet across networks.
  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> {
    let wallets: { wallet: Wallet, network: NetworkConfig }[] = []
    if (chainId) {
      const v = this.getWalletByNetwork(chainId)
      if (v) {
        wallets.push(v)
      }
    } else {
      wallets = this._wallets
    }
    return (await Promise.all(wallets.map(w => w.wallet.getWalletConfig()))).flat()
  }

  async getWalletState(chainId?: ChainId): Promise<WalletState[]> {
    let wallets: { wallet: Wallet, network: NetworkConfig }[] = []
    if (chainId) {
      const v = this.getWalletByNetwork(chainId)
      if (v) {
        wallets.push(v)
      }
    } else {
      wallets = this._wallets
    }

    const states = (await Promise.all(wallets.map(w => w.wallet.getWalletState()))).flat()

    // fetch the current config for the AuthChain, as it will be available
    const idx = states.findIndex(s => s.chainId === this.getAuthChainId())
    if (idx >= 0) {
      states[idx].config = await this.currentConfig(wallets[idx].wallet)
    }

    return states
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

  async getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    if (!chainId) return this.mainWallet()?.wallet.getProvider()
    return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getProvider()
  }

  async getRelayer(chainId?: number): Promise<Relayer | undefined> {
    if (!chainId) return this.mainWallet()?.wallet.getRelayer()
    return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getRelayer()
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    return this.options.networks!
  }

  getAuthChainId(): number {
    let n = this.options.networks![0]
    if (n.isAuthChain) return n.chainId
    n = this.options.networks![1]
    if (n.isAuthChain) return n.chainId
    throw new Error('expecting authChain to be the first or second in networks list')
  }

  async signMessage(message: BytesLike, target?: Wallet | ChainId, allSigners: boolean = true): Promise<string> {
    let { wallet, network } = await (async () => { // eslint-disable-line
      if (!target) {
        return this.mainWallet()
      }
      if ((<Wallet>target).address) {
        const chainId = await ((<Wallet>target).getChainId())
        return this.getWalletByNetwork(chainId)
      }
      return this.getWalletByNetwork(target as ChainId)
    })()

    // Fetch the latest config of the wallet.
    //
    // We skip this step if wallet is authWallet. The assumption is that authWallet
    // will already have the latest config, but lets confirm that.
    // TODO: instead, memoize the currentConfig, as below will break
    // if we skip
    // if (!network.isAuthChain) {
      let thisConfig = await this.currentConfig(wallet)
      thisConfig = thisConfig ? thisConfig : this._wallets[0].wallet.config
      wallet = wallet.useConfig(thisConfig)
    // }

    // See if wallet and available signers set has enough signer power,
    // but if allSigners is false, we allow partial signing
    const weight = await wallet.signWeight()
    if (weight.lt(wallet.config.threshold) && allSigners !== false) {
      throw new NotEnoughSigners(`Sign message - wallet combined weight ${weight.toString()} below required ${wallet.config.threshold.toString()}`)
    }

    return wallet.signMessage(message, undefined, allSigners)
  }

  // TODO: should allSigners default to false here..?
  async signAuthMessage(message: BytesLike, allSigners: boolean = true): Promise<string> {
    return this.signMessage(message, this.authWallet()?.wallet, allSigners)
  }

  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, message: Record<string, any>, chainId?: ChainId, allSigners: boolean = true): Promise<string> {
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
    const hash = encodeTypedDataHash({ domain, types, message })
    return this.signMessage(hash, wallet, allSigners)
  }

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, message: Record<string, any>, chainId?: ChainId, allSigners: boolean = true): Promise<string> {
    return this.signTypedData(domain, types, message, chainId, allSigners)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, chainId?: ChainId, allSigners: boolean = true): Promise<TransactionResponse> {
    const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet

    // TODO: Skip this step if wallet is authWallet
    const [thisConfig, lastConfig] = await Promise.all([
      this.currentConfig(wallet), this.currentConfig()
    ])

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig!).signWeight()
    if (weight.lt(thisConfig!.threshold) && allSigners) {
      throw new NotEnoughSigners(`sendTransaction(), wallet combined weight ${weight.toString()} below required threshold ${thisConfig!.threshold.toString()}`)
    }

    // If the wallet is updated, procede to transaction send
    if (isConfigEqual(lastConfig!, thisConfig!)) {
      return wallet.useConfig(lastConfig!).sendTransaction(transaction)
    }

    // Bundle with configuration update
    const transactionParts = (() => {
      if (Array.isArray(transaction)) {
        return transaction
      } else {
        return [transaction]
      }
    })()

    return wallet.useConfig(thisConfig!).sendTransaction([
      ...await wallet.buildUpdateConfigTransaction(lastConfig!, false),
      ...transactionParts
    ])
  }

  signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
    return wallet.signTransactions(txs, chainId, allSigners)
  }

  async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet().wallet
    return wallet.sendSignedTransactions(signedTxs)
  }

  // updateConfig will build an updated config transaction, update the imageHash on-chain and also publish
  // the wallet config to the authChain. Other chains are lazy-updated on-demand as batched transactions.
  async updateConfig(newConfig?: WalletConfig, index?: boolean): Promise<[WalletConfig, TransactionResponse | undefined]> {
    const authWallet = this.authWallet().wallet

    if (!newConfig) {
      newConfig = authWallet.config
    } else {
      // ensure its normalized
      newConfig = sortConfig(newConfig)
    }

    // The config is the default config, see if the wallet has been deployed
    if (isConfigEqual(authWallet.config, newConfig)) {
      if (!(await this.isDeployed())) {
        // Deploy the wallet and publish initial configuration
        return await authWallet.updateConfig(newConfig, undefined, true, index)
      }
    }

    // Get latest config, update only if neccesary
    const lastConfig = await this.currentConfig()
    if (isConfigEqual(lastConfig!, newConfig)) {
      return [{
        ...lastConfig!,
        address: this.address
      }, undefined]
    }

    // Update to new configuration on the authWallet. Other networks will be lazily updated
    // once used. The wallet config is also auto-published to the authChain.
    const [_, tx] = await authWallet.useConfig(lastConfig!).updateConfig(newConfig, undefined, true, index)

    return [{
      ...newConfig,
      address: this.address
    }, tx]
  }

  // publishConfig will publish the wallet config to the network via the relayer. Publishing
  // the config will also store the entire object of signers.
  publishConfig(indexed?: boolean): Promise<TransactionResponse> {
    return this.authWallet().wallet.publishConfig(indexed)
  }

  async isDeployed(target?: Wallet | ChainId): Promise<boolean> {
    const wallet = (() => {
      if (!target) return this.authWallet().wallet
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig).wallet
    })()
    return wallet.isDeployed()
  }

  // TODO: Split this to it's own class "configProvider" or something
  // this process can be done in different ways (caching, api, utils, etc)
  async currentConfig(target?: Wallet | NetworkConfig): Promise<WalletConfig | undefined> {
    const wallet = (() => {
      if (!target) return this.authWallet().wallet
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig).wallet
    })()

    return (await this.getConfigFinder().findCurrentConfig({
      address: this.address,
      provider: wallet.provider,
      context: wallet.context,
      knownConfigs: [wallet.config]
    })).config
  }

  getWallets(): { wallet: Wallet, network: NetworkConfig }[] {
    return this._wallets
  }

  getWalletByNetwork(chainId: ChainId) {
    const networkId = getNetworkId(chainId)
    const network = this._wallets.find(w => w.network.chainId === networkId)
    if (!network) {
      throw new Error(`network ${chainId} not found in wallets list`)
    }
    return network
  }

  // mainWallet is the DefaultChain wallet
  mainWallet(): { wallet: Wallet, network: NetworkConfig } {
    const found = this._wallets.find(w => w.network.isDefaultChain)
    if (!found) {
      throw new Error('mainWallet not found')
    }
    return found
  }

  // authWallet is the AuthChain wallet
  authWallet(): { wallet: Wallet, network: NetworkConfig } {
    const found = this._wallets.find(w => w.network.isAuthChain)
    if (!found) {
      throw new Error('authChain wallet not found')
    }
    return found
  }

  setNetworks(mainnetNetworks: Networks, testnetNetworks: Networks = [], defaultChainId?: string | number) {
    let networks: Networks = []

    // force-convert to a number in case someone sends a number in a string like "1"
    const defaultChainIdNum = parseInt(defaultChainId as any)

    // find chain between mainnet and testnet network groups, and set that network group.
    // otherwise use mainnetNetworks without changes
    if (testnetNetworks && testnetNetworks.length > 0 && defaultChainId) {
      const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
      if (mainnetNetwork) {
        mainnetNetwork.isDefaultChain = true
        networks = mainnetNetworks
      } else {
        const testnetNetwork = testnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
        if (testnetNetwork) {
          testnetNetwork.isDefaultChain = true
          networks = testnetNetworks
        }
      }
    } else if (mainnetNetworks && mainnetNetworks.length > 0 && defaultChainId) {
      const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainIdNum)
      if (mainnetNetwork) {
        mainnetNetwork.isDefaultChain = true
        networks = mainnetNetworks
      }
    } else {
      networks = mainnetNetworks
    }

    // assign while validating network list
    this.options.networks = ensureValidNetworks(sortNetworks(networks, defaultChainId))

    // Account/wallet instances using the initial configuration and network list
    //
    // TODO: we can make an optimization where if mainnetNetworks and testnetNetworks lists
    // haven't changed between calls, and only the defaultChainId, as well, the group between
    // mainnet vs testnet has not changed either -- aka just defaultChainId within a group,
    // then we can avoid rebuilding all of these objects and instead just sort them
    this._wallets = this.options.networks.map(network => {
      const wallet = new Wallet({
        config: this.options.initialConfig,
        context: this.options.context
      }, ...this._signers)

      if (network.provider) {
        wallet.setProvider(network.provider)
      } else if (network.rpcUrl && network.rpcUrl !== '') {
        wallet.setProvider(network.rpcUrl)
      } else {
        throw new Error(`network config is missing provider settings for chainId ${network.chainId}`)
      }

      if (network.relayer) {
        wallet.setRelayer(network.relayer)
      } else if (network.relayerUrl && network.relayerUrl !== '') {
        wallet.setRelayer(new RpcRelayer(
          network.relayerUrl,
          true,
          network.provider || new ethers.providers.JsonRpcProvider(network.rpcUrl)
        ))
      } else {
        throw new Error(`network config is missing relayer settings for chainId ${network.chainId}`)
      }

      if (network.isDefaultChain) {
        this.provider = wallet.provider
      }
      return {
        network: network,
        wallet: wallet
      }
    })
  }

  connect(_: Provider): AbstractSigner {
    throw new Error('connect method is not supported in MultiWallet')
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in MultiWallet, please use signTransactions(...)')
  }
}

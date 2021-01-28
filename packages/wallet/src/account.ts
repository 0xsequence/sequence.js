import { TransactionResponse, TransactionRequest, JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, Contract, ethers, BytesLike, BigNumberish } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Deferrable } from '@ethersproject/properties'
import { walletContracts } from '@0xsequence/abi'
import { Signer, NotEnoughSigners } from './signer'
import { SignedTransactions, Transactionish } from '@0xsequence/transactions'
import { WalletConfig, WalletState, addressOf, imageHash, isConfigEqual } from '@0xsequence/config'
import { ChainId, Networks, NetworkConfig, WalletContext, sequenceContext, mainnetNetworks, isNetworkConfig, ensureValidNetworks, sortNetworks, getNetworkId } from '@0xsequence/network'
import { Wallet } from './wallet'
import { resolveArrayProperties, findLatestLog } from './utils'
import { Relayer, RpcRelayer } from '@0xsequence/relayer'

export interface AccountOptions {
  initialConfig: WalletConfig
  networks?: NetworkConfig[]
  context?: WalletContext
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
    return this.options.context
  }

  // getWalletConfig builds a list of WalletConfigs across all networks.
  // This is useful to shows all keys/devices connected to a wallet across networks.
  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> {
    let wallets: { wallet: Wallet, network: NetworkConfig }[] = []
    if (chainId) {
      wallets.push(this.getWalletByNetwork(chainId))
    } else {
      wallets = this._wallets
    }
    return (await Promise.all(wallets.map(w => w.wallet.getWalletConfig()))).flat()
  }

  async getWalletState(chainId?: ChainId): Promise<WalletState[]> {
    let wallets: { wallet: Wallet, network: NetworkConfig }[] = []
    if (chainId) {
      wallets.push(this.getWalletByNetwork(chainId))
    } else {
      wallets = this._wallets
    }

    const states = (await Promise.all(wallets.map(w => w.wallet.getWalletState()))).flat()

    const idx = states.findIndex(s => s.chainId === this.authChainId())
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

  getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    if (!chainId) return this.mainWallet().getProvider()
    return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getProvider()
  }

  getRelayer(chainId?: number): Promise<Relayer | undefined> {
    if (!chainId) return this.mainWallet().getRelayer()
    return this._wallets.find(w => w.network.chainId === chainId)?.wallet.getRelayer()
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    return this.options.networks
  }

  async signAuthMessage(message: BytesLike, allSigners: boolean = true): Promise<string> {
    return this.signMessage(message, this.authWallet(), allSigners)
  }

  async signMessage(message: BytesLike, target?: Wallet | ChainId, allSigners: boolean = true): Promise<string> {
    let wallet = (() => {
      if (!target) return this.mainWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig).wallet
    })()

    // Fetch the latest config of the wallet
    // TODO: Skip this step if wallet is authWallet
    let thisConfig = await this.currentConfig(wallet)
    thisConfig = thisConfig ? thisConfig : this._wallets[0].wallet.config

    wallet = wallet.useConfig(thisConfig)

    // See if wallet has enough signer power
    const weight = await wallet.signWeight()
    if (weight.lt(thisConfig.threshold) && allSigners) {
      throw new NotEnoughSigners(`Sign message - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    return wallet.signMessage(message)
  }

  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, message: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet()
    return wallet.signTypedData(domain, types, message, chainId, allSigners)
  }

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, message: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.signTypedData(domain, types, message, chainId, allSigners)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, chainId?: ChainId, allSigners: boolean = true): Promise<TransactionResponse> {
    const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet()

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
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet()
    return wallet.signTransactions(txs, chainId, allSigners)
  }

  async sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    const wallet = chainId ? this.getWalletByNetwork(chainId).wallet : this.mainWallet()
    return wallet.sendSignedTransactions(signedTxs)
  }

  // updateConfig will build an updated config transaction, update the imageHahs on-chain and also publish
  // the wallet config to the authChain. Other chains are lazy-updated on-demand as batched transactions.
  async updateConfig(newConfig?: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> {
    const authWallet = this.authWallet()

    if (!newConfig) {
      newConfig = authWallet.config
    }

    // The config is the default config, see if the wallet has been deployed
    if (isConfigEqual(authWallet.config, newConfig)) {
      if (!(await this.isDeployed())) {
        // Deploy the wallet and publish initial configuration
        return await authWallet.updateConfig(newConfig, undefined, true)
      }
    }

    // Get latest config, update only if neccesary
    const lastConfig = await this.currentConfig()
    if (isConfigEqual(lastConfig, newConfig)) {
      return [{
        ...lastConfig,
        address: this.address
      }, undefined]
    }

    // Update to new configuration on the authWallet. Other networks will be lazily updated
    // once used. The wallet config is also auto-published to the authChain.
    const [_, tx] = await authWallet.useConfig(lastConfig).updateConfig(newConfig, undefined, true)

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
    const wallet = (() => {
      if (!target) return this.authWallet()
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
      if (!target) return this.authWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.getWalletByNetwork(target as NetworkConfig).wallet
    })()

    const address = this.address
    const chainId = await wallet.getChainId()

    // fetch current wallet image hash from chain, and skip any errors
    const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, wallet.provider)
    const currentImageHash = await (walletContract.functions.imageHash.call([]).catch(() => [])) as string[]

    // fetch wallet implementation, which tells us if its been deployed, and verifies its the main module
    const currentImplementation = ethers.utils.defaultAbiCoder.decode(
      ['address'],
      ethers.utils.hexZeroPad(
        await (wallet.provider.getStorageAt(address, address).catch(() => ethers.constants.AddressZero)), 32
      )
    )[0]

    const authWallet = this.authWallet()
    const authContract = new Contract(authWallet.context.sequenceUtils, walletContracts.sequenceUtils.abi, authWallet.provider)

    let event: any
    if (currentImplementation === wallet.context.mainModuleUpgradable) {
      // Wallet is deployed on chain, test if given config is the updated one
      if (imageHash(authWallet.config) === currentImageHash[0]) {
        return { ...authWallet.config, address, chainId }
      }

      // The wallet has been updated. Lookup configuration using imageHash from the authChain
      // which will be the last published entry
      const filter = authContract.filters.RequiredConfig(null, currentImageHash)
      const lastLog = await findLatestLog(authWallet.provider, { ...filter, fromBlock: 0, toBlock: 'latest'})
      if (lastLog === undefined) return undefined
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    
    } else {
      // Wallet is undeployed, test if given config is counter-factual config
      if (addressOf(authWallet.config, authWallet.context).toLowerCase() === address.toLowerCase()) {
        return { ...authWallet.config, chainId }
      }

      // The wallet it's using the counter-factual configuration, get the init config from the authChain
      const filter = authContract.filters.RequiredConfig(address)
      const lastLog = await findLatestLog(authWallet.provider, { ...filter, fromBlock: 0, toBlock: 'latest'})
      if (lastLog === undefined) return undefined
      event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    }

    const signers = ethers.utils.defaultAbiCoder.decode(
      [`tuple(
        uint256 weight,
        address signer
      )[]`], event._signers
    )[0]

    const config = {
      chainId: chainId,
      address: address,
      threshold: ethers.BigNumber.from(event._threshold).toNumber(),
      signers: signers.map((s: any) => ({
        address: s.signer,
        weight: ethers.BigNumber.from(s.weight).toNumber()
      }))
    }

    return config
  }

  getWallets(): { wallet: Wallet, network: NetworkConfig }[] {
    return this._wallets
  }

  getWalletByNetwork(chainId: ChainId) {
    const networkId = getNetworkId(chainId)
    return this._wallets.find(w => w.network.chainId === networkId)
  }

  mainWallet(): Wallet {
    const found = this._wallets.find(w => w.network.isDefaultChain).wallet
    if (!found) {
      throw new Error('mainWallet not found')
    }
    return found
    // return found ? found : this._wallets[0].wallet
  }

  authWallet(): Wallet {
    const found = this._wallets.find(w => w.network.isAuthChain).wallet
    if (!found) {
      throw new Error('authChain wallet not found')
    }
    return found
  }

  authChainId(): number {
    let n = this.options.networks[0]
    if (n.isAuthChain) return n.chainId
    n = this.options.networks[1]
    if (n.isAuthChain) return n.chainId
    throw new Error('expecting authChain to be the first or second in networks list')
  }

  setNetworks(mainnetNetworks: Networks, testnetNetworks: Networks = [], defaultChainId?: string | number) {
    let networks: Networks = []

    // find chain between mainnet and testnet network groups, and set that network group.
    // otherwise use mainnetNetworks without changes
    if (testnetNetworks && testnetNetworks.length > 0 && defaultChainId) {
      const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainId)
      if (mainnetNetwork) {
        mainnetNetwork.isDefaultChain = true
        networks = mainnetNetworks
      } else {
        const testnetNetwork = testnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainId)
        if (testnetNetwork) {
          testnetNetwork.isDefaultChain = true
          networks = testnetNetworks
        }
      }
    } else if (mainnetNetworks && mainnetNetworks.length > 0 && defaultChainId) {
      const mainnetNetwork = mainnetNetworks.find(n => n.name === defaultChainId || n.chainId === defaultChainId)
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

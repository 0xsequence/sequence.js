import { ethers } from 'ethers'
import { SequenceClient } from './client'
import { EIP1193Provider, ChainIdLike, NetworkConfig, allNetworks, findNetworkConfig } from '@0xsequence/network'
import { ConnectDetails, ConnectOptions, OpenWalletIntent, OptionalChainIdLike, WalletSession } from './types'
import { commons } from '@0xsequence/core'
import { WalletUtils } from './utils/index'
import { SequenceSigner, SingleNetworkSequenceSigner } from './signer'

export interface ISequenceProvider {
  readonly _isSequenceProvider: true

  connect(options?: ConnectOptions): Promise<ConnectDetails>
  disconnect(): void

  isConnected(): boolean
  getSession(): WalletSession | undefined

  listAccounts(): string[]

  // @deprecated use getSigner().getAddress() instead
  getAddress(): string

  getNetworks(): Promise<NetworkConfig[]>
  getChainId(): number

  setDefaultChainId(chainId: ChainIdLike): void

  isOpened(): boolean
  openWallet(path?: string, intent?: OpenWalletIntent): Promise<boolean>
  closeWallet(): void

  getProvider(): SequenceProvider
  getProvider(chainId: ChainIdLike): SingleNetworkSequenceProvider
  getProvider(chainId?: ChainIdLike): SequenceProvider | SingleNetworkSequenceProvider

  getSigner(): SequenceSigner
  getSigner(chainId: ChainIdLike): SingleNetworkSequenceSigner
  getSigner(chainId?: ChainIdLike): SequenceSigner | SingleNetworkSequenceSigner

  // @deprecated use getSigner().getWalletContext() instead
  getWalletContext(): Promise<commons.context.VersionedContext>

  // @deprecated use getSigner().getWalletConfig() instead
  getWalletConfig(chainId?: ChainIdLike): Promise<commons.config.Config>

  utils: WalletUtils
}

const EIP1193EventTypes = ['connect', 'disconnect', 'chainChanged', 'accountsChanged'] as const
type EIP1193EventType = (typeof EIP1193EventTypes)[number]

export class SequenceProvider extends ethers.AbstractProvider implements ISequenceProvider, EIP1193Provider {
  private readonly singleNetworkProviders: { [chainId: number]: SingleNetworkSequenceProvider } = {}

  readonly _isSequenceProvider = true
  readonly utils: WalletUtils

  readonly signer: SequenceSigner

  readonly eip1193EventListeners = new Map<EIP1193EventType, Set<ethers.Listener>>()

  constructor(
    public readonly client: SequenceClient,
    private readonly providerFor: (networkId: number) => ethers.JsonRpcProvider,
    public readonly networks: NetworkConfig[] = allNetworks,
    public readonly options?: ethers.AbstractProviderOptions
  ) {
    // We support a lot of networks
    // but we start with the default one
    super(client.getChainId(), options)

    // Emit events as defined by EIP-1193
    client.onConnect(details => {
      //this.emit('connect', details)
      this.eip1193EventListeners.get('connect')?.forEach(listener => listener(details))
    })

    client.onDisconnect(error => {
      //this.emit('disconnect', error)
      this.eip1193EventListeners.get('disconnect')?.forEach(listener => listener(error))
    })

    client.onDefaultChainIdChanged(chainId => {
      //this.emit('chainChanged', chainId)
      this.eip1193EventListeners.get('chainChanged')?.forEach(listener => listener(chainId))
    })

    client.onAccountsChanged(accounts => {
      //this.emit('accountsChanged', accounts)
      this.eip1193EventListeners.get('accountsChanged')?.forEach(listener => listener(accounts))
    })

    // NOTICE: We don't emit 'open' and 'close' events
    // because these are handled by the library, and they
    // are not part of EIP-1193

    // devs can still access them using
    //   client.onOpen()
    //   client.onClose()

    // Create a Sequence signer too
    this.signer = new SequenceSigner(this.client, this)

    // Create a utils instance
    this.utils = new WalletUtils(this.signer)
  }

  async on(event: ethers.ProviderEvent | EIP1193EventType, listener: ethers.Listener): Promise<this> {
    if (EIP1193EventTypes.includes(event as EIP1193EventType)) {
      const listeners = this.eip1193EventListeners.get(event as EIP1193EventType) || new Set()
      listeners.add(listener)
      this.eip1193EventListeners.set(event as EIP1193EventType, listeners)

      return this
    }

    return super.on(event, listener) as Promise<this>
  }

  async off(event: ethers.ProviderEvent | EIP1193EventType, listener?: ethers.Listener | undefined): Promise<this> {
    if (EIP1193EventTypes.includes(event as EIP1193EventType)) {
      const listeners = this.eip1193EventListeners.get(event as EIP1193EventType)

      if (listeners) {
        if (listener) {
          listeners.delete(listener)
        } else {
          listeners.clear()
        }
      }

      return this
    }

    return super.off(event, listener) as Promise<this>
  }

  getSigner(): SequenceSigner
  getSigner(chainId: ChainIdLike): SingleNetworkSequenceSigner
  getSigner(chainId?: ChainIdLike): SequenceSigner | SingleNetworkSequenceSigner

  getSigner(chainId?: ChainIdLike) {
    return this.signer.getSigner(chainId)
  }

  connect(options: ConnectOptions) {
    return this.client.connect(options)
  }

  disconnect() {
    return this.client.disconnect()
  }

  isConnected() {
    return this.client.isConnected()
  }

  getSession() {
    return this.client.getSession()
  }

  listAccounts(): string[] {
    return [this.client.getAddress()]
  }

  // @deprecated use getSigner() instead
  getAddress() {
    return this.client.getAddress()
  }

  getNetworks(): Promise<NetworkConfig[]> {
    return this.client.getNetworks()
  }

  getChainId(): number {
    return this.client.getChainId()
  }

  setDefaultChainId(chainId: ChainIdLike) {
    return this.client.setDefaultChainId(this.toChainId(chainId))
  }

  isOpened(): boolean {
    return this.client.isOpened()
  }

  closeWallet(): void {
    return this.client.closeWallet()
  }

  getWalletContext(): Promise<commons.context.VersionedContext> {
    return this.client.getWalletContext()
  }

  // @deprecated use getSigner() instead
  async getWalletConfig(chainId?: ChainIdLike): Promise<commons.config.Config> {
    const useChainId = await this.useChainId(chainId)
    return this.client.getOnchainWalletConfig({ chainId: useChainId })
  }

  authorize(options: ConnectOptions) {
    // Just an alias for connect with authorize: true
    return this.client.connect({ ...options, authorize: true })
  }

  async openWallet(path?: string, intent?: OpenWalletIntent) {
    await this.client.openWallet(path, intent)
    return true
  }

  toChainId(chainId: ChainIdLike): number
  toChainId(chainId?: ChainIdLike): number | undefined

  toChainId(chainId?: ChainIdLike) {
    if (chainId === undefined) {
      return undefined
    }

    const resolved = findNetworkConfig(this.networks, chainId as ChainIdLike)

    if (!resolved) {
      throw new Error(`Unsupported network ${chainId}`)
    }

    return resolved.chainId
  }

  /**
   *  Resolves the chainId to use for the given request. If no chainId is provided,
   *  it uses the chainId defined by the client (default chainId). This can be
   *  overriden to build a single-network SequenceProvider.
   */
  protected async useChainId(chainId?: ChainIdLike): Promise<number> {
    return this.toChainId(chainId) || this.client.getChainId()
  }

  /**
   *  This generates a provider that ONLY works for the given chainId.
   *  the generated provider can't switch networks, and can't handle requests
   *  for other networks.
   */
  getProvider(): SequenceProvider
  getProvider(chainId: ChainIdLike): SingleNetworkSequenceProvider
  getProvider(chainId?: ChainIdLike): SequenceProvider | SingleNetworkSequenceProvider

  getProvider(chainId?: ChainIdLike) {
    // The provider without a chainId is... this one
    if (!chainId) {
      return this as SequenceProvider
    }

    const useChainId = this.toChainId(chainId)

    if (!this.singleNetworkProviders[useChainId]) {
      this.singleNetworkProviders[useChainId] = new SingleNetworkSequenceProvider(
        this.client,
        this.providerFor,
        useChainId,
        this.options
      )
    }

    return this.singleNetworkProviders[useChainId]
  }

  /**
   *  This returns a subprovider, this is a regular non-sequence provider that
   *  can be used to fulfill read only requests on a given network.
   */
  async _getSubprovider(chainId?: ChainIdLike): Promise<ethers.JsonRpcProvider> {
    const useChainId = await this.useChainId(chainId)

    // Whoever implements providerFrom should memoize the generated provider
    // otherwise every instance of SequenceProvider will create a new subprovider
    const provider = this.providerFor(useChainId)

    if (!provider) {
      throw new Error(`Unsupported network ${useChainId}`)
    }

    return provider
  }

  async _perform(req: ethers.PerformActionRequest): Promise<any> {
    const { method, ...args } = req

    const provider = await this._getSubprovider()
    const prepared = provider.getRpcRequest(req) ?? { method, args: Object.values(args) }

    if (!prepared) {
      throw new Error(`Unsupported method ${req.method}`)
    }

    return provider.send(prepared.method, prepared.args)
  }

  async perform(method: string, params: any): Promise<any> {
    // First we check if the method should be handled by the client
    if (method === 'eth_chainId') {
      return ethers.toQuantity(await this.useChainId())
    }

    if (method === 'eth_accounts') {
      return [this.client.getAddress()]
    }

    if (method === 'wallet_switchEthereumChain') {
      const args = params[0] as { chainId: string } | number | string
      const chainId = normalizeChainId(args)
      return this.setDefaultChainId(chainId)
    }

    // Usually these methods aren't used by calling the provider
    // but to maximize compatibility we support them too.
    // The correct way of accessing these methods is by using .getSigner()
    if (
      method === 'eth_sendTransaction' ||
      method === 'eth_sign' ||
      method === 'eth_signTypedData' ||
      method === 'eth_signTypedData_v4' ||
      method === 'personal_sign' ||
      // These methods will use EIP-6492
      // but this is handled directly by the wallet
      method === 'sequence_sign' ||
      method === 'sequence_signTypedData_v4'
    ) {
      // We pass the chainId to the client, if we don't pass one
      // the client will use its own default chainId
      return this.client.request({ method, params, chainId: this.getChainId() })
    }

    return this._perform({ method, ...params })
  }

  send(method: string, params: any): Promise<any> {
    return this.perform(method, params)
  }

  request(request: { method: string; params?: any[] | undefined }) {
    return this.perform(request.method, request.params)
  }

  async _detectNetwork(): Promise<ethers.Network> {
    const chainId = this.client.getChainId()
    const found = findNetworkConfig(this.networks, chainId)

    if (!found) {
      throw new Error(`Unknown network ${chainId}`)
    }

    const network = new ethers.Network(found.name, found.chainId)

    return network
  }

  async detectNetwork(): Promise<ethers.Network> {
    return this._detectNetwork()
  }

  // Override most of the methods, so we add support for an optional chainId
  // argument, which is used to select the provider to use.
  //
  // NOTICE: We could use generics to avoid repeating the same code
  // but this would make the code harder to read, and it's not worth it
  // since we only have a few methods to override.

  async waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.waitForTransaction(transactionHash, confirmations, timeout)
  }

  async getBlockNumber(optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getBlockNumber()
  }

  async getFeeData(optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getFeeData()
  }

  async getBalance(addressOrName: string | Promise<string>, blockTag?: ethers.BlockTag, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getBalance(addressOrName, blockTag)
  }

  async getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: ethers.BlockTag,
    optionals?: OptionalChainIdLike
  ) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getTransactionCount(addressOrName, blockTag)
  }

  async getCode(addressOrName: string | Promise<string>, blockTag?: ethers.BlockTag, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getCode(addressOrName, blockTag)
  }

  async getStorage(
    addressOrName: string | Promise<string>,
    position: ethers.BigNumberish,
    blockTag?: ethers.BlockTag,
    optionals?: OptionalChainIdLike
  ) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getStorage(addressOrName, position, blockTag)
  }

  async call(transaction: ethers.TransactionRequest, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.call(transaction)
  }

  async estimateGas(transaction: ethers.TransactionRequest, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.estimateGas(transaction)
  }

  async getBlock(blockHashOrBlockTag: ethers.BlockTag | string, prefetchTxs?: boolean, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getBlock(blockHashOrBlockTag, prefetchTxs)
  }

  async getTransaction(transactionHash: string, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getTransaction(transactionHash)
  }

  async getLogs(filter: ethers.Filter, optionals?: OptionalChainIdLike) {
    const provider = await this._getSubprovider(optionals?.chainId)
    return provider.getLogs(filter)
  }

  // ENS methods

  async supportsENS(): Promise<boolean> {
    const networks = await this.getNetworks()
    return networks.some(n => n.chainId === 1)
  }

  async getResolver(name: string) {
    if (!(await this.supportsENS())) {
      return null
    }

    // Resolver is always on the chainId 1
    const provider = await this._getSubprovider(1)
    return provider.getResolver(name)
  }

  async resolveName(name: string) {
    if (ethers.isAddress(name)) {
      return name
    }

    if (!(await this.supportsENS())) {
      return null
    }

    // Resolver is always on the chainId 1
    const provider = await this._getSubprovider(1)
    return provider.resolveName(name)
  }

  async lookupAddress(address: string) {
    if (!(await this.supportsENS())) {
      return null
    }

    // Resolver is always on the chainId 1
    const provider = await this._getSubprovider(1)
    return provider.lookupAddress(address)
  }

  async getAvatar(nameOrAddress: string) {
    if (!(await this.supportsENS())) {
      return null
    }

    const provider = await this._getSubprovider(1)
    return provider.getAvatar(nameOrAddress)
  }

  static is = (provider: any): provider is SequenceProvider => {
    return provider && typeof provider === 'object' && provider._isSequenceProvider === true
  }
}

function normalizeChainId(chainId: ethers.BigNumberish | { chainId: string }): number {
  if (typeof chainId === 'object') return normalizeChainId(chainId.chainId)
  return Number(chainId)
}

/**
 *  This is the same provider, but it only allows a single network at a time.
 *  the network defined by the constructor is the only one that can be used.
 *
 *  Attempting to call any method with a different network will throw an error.
 *  Attempting to change the network of this provider will throw an error.
 *
 *  NOTICE: These networks won't support ENS unless they are the mainnet.
 */
export class SingleNetworkSequenceProvider extends SequenceProvider {
  readonly _isSingleNetworkSequenceProvider = true

  constructor(
    client: SequenceClient,
    providerFor: (networkId: number) => ethers.JsonRpcProvider,
    public readonly chainId: ChainIdLike,
    options?: ethers.AbstractProviderOptions
  ) {
    super(client, providerFor, undefined, options)
  }

  private _useChainId(chainId?: ChainIdLike): number {
    const provided = this.toChainId(chainId)

    if (provided && provided !== this.chainId) {
      throw new Error(`This provider only supports the network ${this.chainId}, but ${provided} was requested.`)
    }

    return provided || super.toChainId(this.chainId)
  }

  protected useChainId(chainId?: ChainIdLike): Promise<number> {
    return Promise.resolve(this._useChainId(chainId))
  }

  getChainId(): number {
    return super.toChainId(this.chainId)
  }

  async getNetwork(): Promise<ethers.Network> {
    const networks = await this.client.getNetworks()
    const found = findNetworkConfig(networks, this.chainId)

    if (!found) {
      throw new Error(`Unsupported network ${this.chainId}`)
    }

    return new ethers.Network(found.name, found.chainId)
  }

  /**
   *  Override getProvider and getSigner so they always use `useChainId`
   *  this way they can't return providers and signers that can switch networks,
   *  or that don't match the chainId of this signer.
   */
  getProvider(chainId?: ChainIdLike): SingleNetworkSequenceProvider {
    if (this._useChainId(chainId) !== this.chainId) {
      throw new Error(`Unreachable code`)
    }

    return this
  }

  getSigner(chainId?: ChainIdLike): SingleNetworkSequenceSigner {
    return super.getSigner(this._useChainId(chainId))
  }

  setDefaultChainId(_chainId: ChainIdLike): void {
    throw new Error(`This provider only supports the network ${this.chainId}; use the parent provider to switch networks.`)
  }

  static is(cand: any): cand is SingleNetworkSequenceProvider {
    return cand && typeof cand === 'object' && cand._isSingleNetworkSequenceProvider === true
  }
}

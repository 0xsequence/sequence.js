import { TransactionResponse, TransactionRequest, Provider } from '@ethersproject/providers'
import { Signer as AbstractSigner, Contract, ethers, BytesLike, BigNumberish } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import { walletContracts } from '@0xsequence/abi'
import { NotEnoughSigners } from './types'
import { Transactionish } from '@0xsequence/transactions'
import { GlobalWalletConfig, SignerInfo, WalletConfig, addressOf, imageHash, isConfig } from '@0xsequence/signer'
import { NetworkConfig, WalletContext } from '@0xsequence/networks'
import { Wallet } from './wallet'
import { resolveArrayProperties } from './utils'

export type MultiWalletOptions = {
  context: WalletContext,
  initialConfig: WalletConfig,
  signers: AbstractSigner[],
  networks: NetworkConfig[]
}

export class MultiWallet extends AbstractSigner {
  private readonly _wallets: {
    wallet: Wallet,
    network: NetworkConfig
  }[]
  provider: ethers.providers.JsonRpcProvider

  constructor(opts: MultiWalletOptions) {
    super()

    if (opts.networks.length === 0) throw new Error('SmartWallet must have networks')

    // Account/wallet instances using the initial configuration
    this._wallets = opts.networks.map((network) => {
      const wallet = new Wallet(opts.initialConfig, opts.context, ...opts.signers)
      wallet.setProvider(network.rpcUrl)
      if (network.relayer) {
        wallet.setRelayer(network.relayer)
      }
      return {
        network: network,
        wallet: wallet
      }
    })

    // TODO: wallets[0] ..? or get the "main" one...?
    this.provider = this._wallets[0].wallet.provider
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

  // getGlobalWalletConfig builds the GlobalWalletConfig object which contains all WalletConfigs across all networks.
  // This is useful to shows all keys/devices connected to a wallet across networks.

  // RENAME: .................         getGlobalWalletConfig(): Promise<GlobalWalletConfig>
  async getFullConfig(): Promise<GlobalWalletConfig> {
    const allConfigs = await Promise.all(this._wallets.map(async (w) => ({ wallet: w, config: await this.currentConfig(w.wallet) })))
    const thresholds = allConfigs.map((c) => ({ chaind: c.wallet.network.chainId, weight: c.config.threshold }))
    const allSigners = allConfigs.reduce((p, config) => {
      config.config.signers.forEach((signer) => {
        const item = p.find((c) => c.address === signer.address)
        const netEntry = {
          weight: signer.weight,
          chaind: config.wallet.network.chainId
        }

        if (!item) {
          p.push({
            address: signer.address,
            networks: [netEntry]
          })
        } else {
          item.networks.push(netEntry)
        }
      })
      return p
    }, [] as SignerInfo[])

    return {
      threshold: thresholds,
      signers: allSigners
    }
  }

  // TODO: *full* sign..? name..?
  async signAuthMessage(message: BytesLike, onlyFullSign: boolean = true): Promise<string> {
    return this.signMessage(message, this.authWallet(), onlyFullSign)
  }

  // TODO: what does onlyFullSign do here..?
  async signMessage(message: BytesLike, target?: Wallet | NetworkConfig | BigNumberish, onlyFullSign: boolean = true): Promise<string> {
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

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && onlyFullSign) {
      throw new NotEnoughSigners(`Sign message - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    return wallet.useConfig(thisConfig).signMessage(message)
  }

  async sendTransaction(dtransactionish: Deferrable<Transactionish>, network?: NetworkConfig | BigNumberish, onlyFullSign: boolean = true): Promise<TransactionResponse> {
    const transaction = await resolveArrayProperties<Transactionish>(dtransactionish)
    const wallet = network ? this.getWalletByNetwork(network) : this.mainWallet()

    // TODO: Skip this step if wallet is authWallet
    const [thisConfig, lastConfig] = await Promise.all([
      this.currentConfig(wallet), this.currentConfig()
    ])

    // See if wallet has enough signer power
    const weight = await wallet.useConfig(thisConfig).signWeight()
    if (weight.lt(thisConfig.threshold) && onlyFullSign) {
      throw new NotEnoughSigners(`Send transaction - wallet combined weight ${weight.toString()} below required ${thisConfig.threshold.toString()}`)
    }

    // If the wallet is updated, procede to transaction send
    if (isConfig(lastConfig, thisConfig)) {
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

  async updateConfig(newConfig: WalletConfig): Promise<TransactionResponse | undefined> {
    // The config is the default config, see if the wallet has been deployed
    if (isConfig(this._wallets[0].wallet.config, newConfig)) {
      if (!(await this.isDeployed())) {
        // Deploy the wallet and publish initial configuration
        return this.authWallet().publishConfig()
      }
    }

    // Get latest config, update only if neccesary
    const lastConfig = await this.currentConfig()
    if (isConfig(lastConfig, newConfig)) {
      return undefined
    }

    // Update to new configuration
    // lazy update all other networks
    const [_, tx] = await this.authWallet()
      .useConfig(lastConfig)
      .updateConfig(newConfig, undefined, true)

    return tx
  }

  async isDeployed(target?: Wallet | NetworkConfig): Promise<boolean> {
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
      // Test if given config is the updated config
      if (imageHash(this._wallets[0].wallet.config) === await currentImageHash) {
        return this._wallets[0].wallet.config
      }

      // The wallet has been updated
      // lookup configuration using imageHash
      const filter = authContract.filters.RequiredConfig(null, await currentImageHash)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
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

  private getWalletByNetwork(network: NetworkConfig | BigNumberish): Wallet {
    const chainId = (() => {
      if ((<NetworkConfig>network).chainId) {
        return (<NetworkConfig>network).chainId
      }
      return ethers.BigNumber.from(network as BigNumberish).toNumber()
    })()

    return this._wallets.find((w) => w.network.chainId === chainId).wallet
  }

  private mainWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isMainChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  private authWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isAuthChain).wallet
    return found ? found : this._wallets[0].wallet
  }

  static isMultiWallet(signer: AbstractSigner): signer is MultiWallet {
    return (<MultiWallet>signer).updateConfig !== undefined
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }

  connect(_: Provider): AbstractSigner {
    throw new Error('Method not implemented.')
  }
}

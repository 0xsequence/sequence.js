import { Signer as AbstractSigner, Contract, ethers } from 'ethers'
import { TransactionResponse, JsonRpcProvider } from 'ethers/providers'
import { Wallet } from './wallet'
import { NetworkConfig, ArcadeumWalletConfig, ArcadeumContext, Transactionish } from './types'
import { Arrayish, BigNumberish } from 'ethers/utils'
import { abi as mainModuleUpgradableAbi } from './abi/mainModuleUpgradable'
import { abi as requireUtilsAbi } from './abi/requireUtils'
import { isConfig } from './utils'
import { NotEnoughSigners } from './errors'

// TODO: Add more details to network
// authChain, mainNetwork, etc
export type NetworkWallet = {
  wallet: Wallet,
  network: NetworkConfig
}

export type MultiWalletParams = {
  context: ArcadeumContext,
  initialConfig: ArcadeumWalletConfig,
  signers: AbstractSigner[],
  networks: NetworkConfig[]
}

type FullConfig = {
  threshold: Threshold[],
  signers: Signer[]
}

type Threshold = {
  chaind: number,
  weight: number
}

type Signer = {
  address: string,
  networks: {
    chaind: number,
    weight: number
  }[]
}

export class MultiWallet extends AbstractSigner {
  private readonly _wallets: NetworkWallet[]
  provider: ethers.providers.JsonRpcProvider

  constructor(params: MultiWalletParams) {
    super()

    if (params.networks.length === 0) throw new Error('MultiWallet must have networks')

    // Generate wallets using the initial configuration
    this._wallets = params.networks.map((network) => {
      let wallet = new Wallet(params.initialConfig, params.context, ...params.signers)
      wallet.setProvider(network.rpcUrl)
      if (network.relayer) {
        wallet.setRelayer(network.relayer)
      }
      return {
        network: network,
        wallet: wallet
      }
    })

    this.provider = this._wallets[0].wallet.provider
  }

  get address(): string {
    return this._wallets[0].wallet.address
  }

  getAddress(): Promise<string> {
    return this._wallets[0].wallet.getAddress()
  }

  async getFullConfig(): Promise<FullConfig> {
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
    }, [] as Signer[])

    return {
      threshold: thresholds,
      signers: allSigners
    }
  }

  async signMessage(message: Arrayish, network?: NetworkConfig, onlyFullSign: boolean = true): Promise<string> {
    const wallet = network ? this.networkWallet(network) : this.mainWallet()

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

  async sendTransaction(transaction: Transactionish, network?: NetworkConfig | BigNumberish, onlyFullSign: boolean = true): Promise<TransactionResponse> {
    const wallet = network ? this.networkWallet(network) : this.mainWallet()

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
      ...await wallet.buildUpdateConfig(lastConfig, false),
      ...transactionParts
    ])
  }

  async updateConfig(newConfig: ArcadeumWalletConfig): Promise<TransactionResponse | undefined> {
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
      return this.networkWallet(target as NetworkConfig)
    })()

    const walletCode = await wallet.provider.getCode(this.address)
    return walletCode && walletCode !== "0x"
  }

  // TODO: Split this to it's own class "configProvider" or something
  // this process can be done in different ways (caching, api, utils, etc)
  async currentConfig(target?: Wallet | NetworkConfig): Promise<ArcadeumWalletConfig | undefined> {
    const address = this.address
    const wallet = (() => {
      if (!target) return this.authWallet()
      if ((<Wallet>target).address) {
        return target as Wallet
      }
      return this.networkWallet(target as NetworkConfig)
    })()
  
    const walletContract = new Contract(address, mainModuleUpgradableAbi, wallet.provider)

    const authWallet = this.authWallet()
    const authContract = new Contract(authWallet.context.requireUtils, requireUtilsAbi, authWallet.provider);

    const currentImageHash = walletContract.functions.imageHash.call([])
    currentImageHash.catch(() => {}) // Ignore no imageHash defined
    const currentImplementation = ethers.utils.defaultAbiCoder.decode(
      ['address'], await wallet.provider.getStorageAt(address, address)
    )[0]

    let event: any
    if (currentImplementation === wallet.context.mainModuleUpgradable) {
      // The wallet has been updated
      // lookup configuration using imageHash
      const filter = authContract.filters.RequiredConfig(null, await currentImageHash)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
      if (logs.length === 0) return undefined
      const lastLog = logs[logs.length - 1]
      event = authContract.interface.events.RequiredConfig.decode(lastLog.data, lastLog.topics)
    } else {
      // The wallet it's using the counter-factual configuration
      const filter = authContract.filters.RequiredConfig(address)
      const logs = await authWallet.provider.getLogs({ fromBlock: 0, toBlock: 'latest', ...filter})
      if (logs.length === 0) return undefined
      const lastLog = logs[0] // TODO: Search for real counter-factual config
      event = authContract.interface.events.RequiredConfig.decode(lastLog.data, lastLog.topics)
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

  private networkWallet(network: NetworkConfig | BigNumberish): Wallet {
    const chainId = (() => {
      if ((<NetworkConfig>network).chainId) {
        return (<NetworkConfig>network).chainId
      }
      return ethers.utils.bigNumberify(network as BigNumberish).toNumber()
    })()

    return this._wallets.find((w) =>w.network.chainId === chainId).wallet
  }

  private mainWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isMain).wallet
    return found ? found : this._wallets[0].wallet
  }

  private authWallet(): Wallet {
    const found = this._wallets.find((w) => w.network.isAuth).wallet
    return found ? found : this._wallets[0].wallet
  }
}

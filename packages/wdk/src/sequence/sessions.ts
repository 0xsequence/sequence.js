import { Wallet } from '@0xsequence/sequence-core'
import { Config, Constants } from '@0xsequence/sequence-primitives'
import { Address, Provider, RpcTransport } from 'ox'
import { SessionController } from '../session'
import { Shared } from './manager'

export class Sessions {
  constructor(private readonly shared: Shared) {}

  async controllerForWallet(address: Address.Address, chainId?: bigint) {
    // Find the session configuration for the wallet
    const wallet = new Wallet(address, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })
    const status = await wallet.getStatus()
    const walletConfig = status.configuration
    const sessionConfigLeaf = Config.findSignerLeaf(walletConfig, Constants.DefaultSessionManager)
    if (!sessionConfigLeaf || !Config.isSapientSignerLeaf(sessionConfigLeaf)) {
      throw new Error(`Session module not found for wallet ${address}`)
    }

    // Get the provider if available
    let provider: Provider.Provider | undefined
    if (chainId) {
      const network = this.shared.sequence.networks.find((network) => network.chainId === chainId)
      if (network) {
        provider = Provider.from(RpcTransport.fromHttp(network.rpc))
      }
    }

    // Create the controller
    const controller = SessionController.createFromStorage(sessionConfigLeaf.imageHash, {
      wallet,
      provider,
    })
    return controller
  }
}

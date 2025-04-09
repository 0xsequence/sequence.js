import { Signers as CoreSigners, Envelope, Wallet } from '@0xsequence/sequence-core'
import { Config, Constants, Payload, SessionConfig } from '@0xsequence/sequence-primitives'
import { Address, Provider, RpcTransport } from 'ox'
import { SessionController } from '../session'
import { Shared } from './manager'

export class Sessions {
  private readonly _sessionControllers: Map<Address.Address, SessionController> = new Map()

  constructor(private readonly shared: Shared) {}

  async getControllerForWallet(walletAddress: Address.Address, chainId?: bigint): Promise<SessionController> {
    if (this._sessionControllers.has(walletAddress)) {
      return this._sessionControllers.get(walletAddress)!
    }

    //FIXME How do we check the wallet is available? Is it necessary?
    // Find the session configuration for the wallet
    const wallet = new Wallet(walletAddress, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })
    const { configuration } = await wallet.getStatus()
    const sessionConfigLeaf = Config.findSignerLeaf(configuration, Constants.DefaultSessionManager)
    if (!sessionConfigLeaf || !Config.isSapientSignerLeaf(sessionConfigLeaf)) {
      throw new Error(`Session module not found for wallet ${walletAddress}`)
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
    const controller = await SessionController.createFromStorage(sessionConfigLeaf.imageHash, {
      wallet,
      provider,
      stateProvider: this.shared.sequence.stateProvider,
    })
    this._sessionControllers.set(walletAddress, controller)
    return controller
  }

  async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    const controller = await this.getControllerForWallet(walletAddress)
    return controller.topology
  }

  async addImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    origin?: string,
  ): Promise<string> {
    //FIXME This is a login request. Not required here?
    throw new Error('Not implemented')
  }

  async addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addExplicitSession(sessionAddress, permissions)
    return this.prepareSessionUpdate(envelope)
  }

  async removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeExplicitSession(sessionAddress)
    return this.prepareSessionUpdate(envelope)
  }

  async addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope)
  }

  async removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope)
  }

  private async prepareSessionUpdate(envelope: Envelope.Envelope<Payload.ConfigUpdate>): Promise<string> {
    const requestId = await this.shared.modules.signatures.request(envelope, 'session-update', {
      origin: 'wallet-webapp',
    })
    return requestId
  }

  async completeSessionUpdate(walletAddress: Address.Address, requestId: string) {
    const controller = await this.getControllerForWallet(walletAddress)
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    const envelope = sigRequest.envelope
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(envelope.payload)) {
      throw new Error('Invalid action')
    }
    console.log('Completing session update:', requestId)
    await controller.completeUpdateConfiguration(envelope as Envelope.Signed<Payload.ConfigUpdate>)
    return this.shared.modules.signatures.complete(requestId)
  }
}

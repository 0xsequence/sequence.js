import { Signers as CoreSigners, Envelope, Wallet } from '@0xsequence/wallet-core'
import { Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address, Provider, RpcTransport } from 'ox'
import { SessionController } from '../session/index.js'
import { Shared } from './manager.js'

export class Sessions {
  private readonly _sessionControllers: Map<Address.Address, SessionController> = new Map()

  constructor(private readonly shared: Shared) {}

  async getControllerForWallet(walletAddress: Address.Address, chainId?: bigint): Promise<SessionController> {
    if (this._sessionControllers.has(walletAddress)) {
      return this._sessionControllers.get(walletAddress)!
    }

    // Construct the wallet
    const wallet = new Wallet(walletAddress, {
      context: this.shared.sequence.context,
      guest: this.shared.sequence.guest,
      stateProvider: this.shared.sequence.stateProvider,
    })

    // Get the provider if available
    let provider: Provider.Provider | undefined
    if (chainId) {
      const network = this.shared.sequence.networks.find((network) => network.chainId === chainId)
      if (network) {
        provider = Provider.from(RpcTransport.fromHttp(network.rpc))
      }
    }

    // Create the controller
    const controller = new SessionController({
      wallet,
      provider,
      stateProvider: this.shared.sequence.stateProvider,
    })
    this._sessionControllers.set(walletAddress, controller)
    return controller
  }

  async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    const controller = await this.getControllerForWallet(walletAddress)
    return controller.getTopology()
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
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addExplicitSession(sessionAddress, permissions)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async removeExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeExplicitSession(sessionAddress)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async addBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async removeBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope, origin)
  }

  private async prepareSessionUpdate(
    envelope: Envelope.Envelope<Payload.ConfigUpdate>,
    origin: string = 'wallet-webapp',
  ): Promise<string> {
    return await this.shared.modules.signatures.request(envelope, 'session-update', {
      origin,
    })
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

import { Envelope, Signers, State, Wallet } from '@0xsequence/wallet-core'
import { Payload, Signature as SequenceSignature, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider } from 'ox'
import { IdentitySigner } from '../identity/signer.js'
type SessionControllerConfiguration = {
  wallet: Wallet
  provider?: Provider.Provider
  identitySigner?: IdentitySigner
  stateProvider?: State.Provider
}
export declare class SessionController {
  private _manager
  private readonly _wallet
  private readonly _identitySigner
  private readonly _stateProvider
  constructor(configuration: SessionControllerConfiguration)
  getTopology(): Promise<SessionConfig.SessionsTopology>
  getImageHash(): Promise<Hex.Hex>
  withProvider(provider: Provider.Provider): SessionController
  addImplicitSession(
    signerAddress: Address.Address,
    attestationParams: Signers.Session.AttestationParams,
  ): Promise<SequenceSignature.SignatureOfSignerLeafHash>
  addExplicitSession(
    signerAddress: Address.Address,
    permissions: Signers.Session.ExplicitParams,
  ): Promise<Envelope.Envelope<Payload.ConfigUpdate>>
  removeExplicitSession(signerAddress: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>>
  addBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>>
  removeBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>>
  private prepareUpdateConfiguration
  completeUpdateConfiguration(envelope: Envelope.Signed<Payload.ConfigUpdate>): Promise<void>
}
export {}
//# sourceMappingURL=session-controller.d.ts.map

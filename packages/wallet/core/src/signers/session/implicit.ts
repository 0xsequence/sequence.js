import {
  Attestation,
  Extensions,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
  SessionSignature,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider, Secp256k1, Signature } from 'ox'
import { MemoryPkStore, PkStore } from '../pk/index.js'
import { ImplicitSessionSigner, SessionSignerValidity } from './session.js'

export type AttestationParams = Omit<Attestation.Attestation, 'approvedSigner'>

export class Implicit implements ImplicitSessionSigner {
  private readonly _privateKey: PkStore
  private readonly _identitySignature: SequenceSignature.RSY
  public readonly address: Address.Address

  constructor(
    privateKey: Hex.Hex | PkStore,
    private readonly _attestation: Attestation.Attestation,
    identitySignature: SequenceSignature.RSY | Hex.Hex,
    private readonly _sessionManager: Address.Address,
  ) {
    this._privateKey = typeof privateKey === 'string' ? new MemoryPkStore(privateKey) : privateKey
    this.address = this._privateKey.address()
    if (this._attestation.approvedSigner !== this.address) {
      throw new Error('Invalid attestation')
    }
    if (this._attestation.authData.issuedAt > BigInt(Math.floor(Date.now() / 1000))) {
      throw new Error('Attestation issued in the future')
    }
    this._identitySignature =
      typeof identitySignature === 'string' ? Signature.fromHex(identitySignature) : identitySignature
  }

  get identitySigner(): Address.Address {
    // Recover identity signer from attestions and identity signature
    const attestationHash = Attestation.hash(this._attestation)
    const identityPubKey = Secp256k1.recoverPublicKey({ payload: attestationHash, signature: this._identitySignature })
    return Address.fromPublicKey(identityPubKey)
  }

  isValid(sessionTopology: SessionConfig.SessionsTopology, _chainId: number): SessionSignerValidity {
    const implicitSigners = SessionConfig.getIdentitySigners(sessionTopology)
    const thisIdentitySigner = this.identitySigner
    if (!implicitSigners.some((s) => Address.isEqual(s, thisIdentitySigner))) {
      return { isValid: false, invalidReason: 'Identity signer not found' }
    }
    const blacklist = SessionConfig.getImplicitBlacklist(sessionTopology)
    if (blacklist?.some((b) => Address.isEqual(b, this.address))) {
      return { isValid: false, invalidReason: 'Blacklisted' }
    }
    return { isValid: true }
  }

  async supportedCall(
    wallet: Address.Address,
    _chainId: number,
    call: Payload.Call,
    _sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<boolean> {
    if (!provider) {
      throw new Error('Provider is required')
    }
    try {
      // Call the acceptImplicitRequest function on the called contract
      const encodedCallData = AbiFunction.encodeData(acceptImplicitRequestFunctionAbi, [
        wallet,
        {
          approvedSigner: this._attestation.approvedSigner,
          identityType: Bytes.toHex(this._attestation.identityType),
          issuerHash: Bytes.toHex(this._attestation.issuerHash),
          audienceHash: Bytes.toHex(this._attestation.audienceHash),
          applicationData: Bytes.toHex(this._attestation.applicationData),
          authData: this._attestation.authData,
        },
        {
          to: call.to,
          value: call.value,
          data: call.data,
          gasLimit: call.gasLimit,
          delegateCall: call.delegateCall,
          onlyFallback: call.onlyFallback,
          behaviorOnError: BigInt(Payload.encodeBehaviorOnError(call.behaviorOnError)),
        },
      ])
      const acceptImplicitRequestResult = await provider.request({
        method: 'eth_call',
        params: [{ from: this._sessionManager, to: call.to, data: encodedCallData }, 'latest'],
      })
      const acceptImplicitRequest = Hex.from(
        AbiFunction.decodeResult(acceptImplicitRequestFunctionAbi, acceptImplicitRequestResult),
      )
      const expectedResult = Bytes.toHex(Attestation.generateImplicitRequestMagic(this._attestation, wallet))
      return acceptImplicitRequest === expectedResult
    } catch (error) {
      // console.log('implicit signer unsupported call', call, error)
      return false
    }
  }

  async signCall(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Calls,
    callIdx: number,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    const call = payload.calls[callIdx]!
    const isSupported = await this.supportedCall(wallet, chainId, call, sessionManagerAddress, provider)
    if (!isSupported) {
      throw new Error('Unsupported call')
    }
    const useDeprecatedHash =
      Address.isEqual(sessionManagerAddress, Extensions.Dev1.sessions) ||
      Address.isEqual(sessionManagerAddress, Extensions.Dev2.sessions)
    const callHash = SessionSignature.hashCallWithReplayProtection(payload, callIdx, chainId, useDeprecatedHash)
    const sessionSignature = await this._privateKey.signDigest(Bytes.fromHex(callHash))
    return {
      attestation: this._attestation,
      identitySignature: this._identitySignature,
      sessionSignature,
    }
  }
}

const acceptImplicitRequestFunctionAbi = {
  type: 'function',
  name: 'acceptImplicitRequest',
  inputs: [
    { name: 'wallet', type: 'address', internalType: 'address' },
    {
      name: 'attestation',
      type: 'tuple',
      internalType: 'struct Attestation',
      components: [
        { name: 'approvedSigner', type: 'address', internalType: 'address' },
        { name: 'identityType', type: 'bytes4', internalType: 'bytes4' },
        { name: 'issuerHash', type: 'bytes32', internalType: 'bytes32' },
        { name: 'audienceHash', type: 'bytes32', internalType: 'bytes32' },
        { name: 'applicationData', type: 'bytes', internalType: 'bytes' },
        {
          internalType: 'struct AuthData',
          name: 'authData',
          type: 'tuple',
          components: [
            { internalType: 'string', name: 'redirectUrl', type: 'string' },
            { internalType: 'uint64', name: 'issuedAt', type: 'uint64' },
          ],
        },
      ],
    },
    {
      name: 'call',
      type: 'tuple',
      internalType: 'struct Payload.Call',
      components: [
        { name: 'to', type: 'address', internalType: 'address' },
        { name: 'value', type: 'uint256', internalType: 'uint256' },
        { name: 'data', type: 'bytes', internalType: 'bytes' },
        { name: 'gasLimit', type: 'uint256', internalType: 'uint256' },
        { name: 'delegateCall', type: 'bool', internalType: 'bool' },
        { name: 'onlyFallback', type: 'bool', internalType: 'bool' },
        { name: 'behaviorOnError', type: 'uint256', internalType: 'uint256' },
      ],
    },
  ],
  outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
  stateMutability: 'view',
} as const

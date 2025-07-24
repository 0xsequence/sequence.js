import { Attestation, Payload, Signature as SequenceSignature, SessionSignature } from '@0xsequence/wallet-primitives'
import { AbiFunction, Bytes, Hex, Provider, Secp256k1, Signature } from 'ox'
import { MemoryPkStore, PkStore } from '../pk/index.js'
import { SessionSigner } from './session.js'

export type AttestationParams = Omit<Attestation.Attestation, 'approvedSigner'>

export class Implicit implements SessionSigner {
  private readonly _privateKey: PkStore
  private readonly _identitySignature: SequenceSignature.RSY
  public readonly address: Address.Checksummed

  constructor(
    privateKey: Hex.Hex | PkStore,
    private readonly _attestation: Attestation.Attestation,
    identitySignature: SequenceSignature.RSY | Hex.Hex,
    private readonly _sessionManager: Address.Checksummed,
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

  get identitySigner(): Address.Checksummed {
    // Recover identity signer from attestions and identity signature
    const attestationHash = Attestation.hash(this._attestation)
    const identityPubKey = Secp256k1.recoverPublicKey({ payload: attestationHash, signature: this._identitySignature })
    return Address.fromPublicKey(identityPubKey)
  }

  async supportedCall(
    wallet: Address.Checksummed,
    _chainId: bigint,
    call: Payload.Call,
    _sessionManagerAddress: Address.Checksummed,
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
    wallet: Address.Checksummed,
    chainId: bigint,
    call: Payload.Call,
    nonce: {
      space: bigint
      nonce: bigint
    },
    sessionManagerAddress: Address.Checksummed,
    provider?: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    const isSupported = await this.supportedCall(wallet, chainId, call, sessionManagerAddress, provider)
    if (!isSupported) {
      throw new Error('Unsupported call')
    }
    const callHash = SessionSignature.hashCallWithReplayProtection(call, chainId, nonce.space, nonce.nonce)
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

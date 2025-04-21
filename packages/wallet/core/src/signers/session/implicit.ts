import { Attestation, Payload, SessionSignature, Signature } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider, Secp256k1 } from 'ox'
import { SignerInterface } from './session.js'

export type AttestationParams = Omit<Attestation.Attestation, 'approvedSigner'>

export class Implicit implements SignerInterface {
  readonly address: Address.Address

  constructor(
    private readonly _privateKey: `0x${string}`,
    private readonly _attestation: Attestation.Attestation,
    private readonly _identitySignature: Signature.RSY,
    private readonly _sessionManager: Address.Address,
  ) {
    this.address = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: this._privateKey }))
    if (this._attestation.approvedSigner !== this.address) {
      throw new Error('Invalid attestation')
    }
  }

  async supportedCall(
    wallet: Address.Address,
    _chainId: bigint,
    call: Payload.Call,
    provider: Provider.Provider,
  ): Promise<boolean> {
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
          data: Bytes.toHex(call.data),
          gasLimit: call.gasLimit,
          delegateCall: call.delegateCall,
          onlyFallback: call.onlyFallback,
          behaviorOnError: BigInt(Payload.encodeBehaviorOnError(call.behaviorOnError)),
        },
      ])
      const acceptImplicitRequestResult = await provider.request({
        method: 'eth_call',
        params: [{ from: this._sessionManager, to: call.to, data: encodedCallData }],
      })
      const acceptImplicitRequest = Hex.from(
        AbiFunction.decodeResult(acceptImplicitRequestFunctionAbi, acceptImplicitRequestResult),
      )
      const expectedResult = Bytes.toHex(Attestation.generateImplicitRequestMagic(this._attestation, wallet))
      return acceptImplicitRequest === expectedResult
    } catch (error) {
      console.log('implicit signer unsupported call', call, error)
      return false
    }
  }

  async signCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    nonce: {
      space: bigint
      nonce: bigint
    },
    provider: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    const isSupported = await this.supportedCall(wallet, chainId, call, provider)
    if (!isSupported) {
      throw new Error('Unsupported call')
    }
    const callHash = SessionSignature.hashCallWithReplayProtection(call, chainId, nonce.space, nonce.nonce)
    const sessionSignature = Secp256k1.sign({ payload: callHash, privateKey: this._privateKey })
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
          components: [{ internalType: 'string', name: 'redirectUrl', type: 'string' }],
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

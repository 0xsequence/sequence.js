import { Attestation, Payload, SessionSignature, Signature } from '@0xsequence/sequence-primitives'
import { AbiFunction, Address, Bytes, Provider, Secp256k1 } from 'ox'
import { SignerInterface } from './session'

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
  }

  async supportedCall(
    wallet: Address.Address,
    _chainId: bigint,
    call: Payload.Call,
    provider: Provider.Provider,
  ): Promise<boolean> {
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
      '0x',
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
      params: [{ from: this._sessionManager, to: call.to, data: encodedCallData }, 'latest'],
    })
    const acceptImplicitRequest = AbiFunction.decodeResult(
      acceptImplicitRequestFunctionAbi,
      acceptImplicitRequestResult,
    )
    const expectedResult = Attestation.generateImplicitRequestMagic(this._attestation, this.address)
    return acceptImplicitRequest === Bytes.toHex(expectedResult)
  }

  async signCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    provider: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    const isSupported = await this.supportedCall(wallet, chainId, call, provider)
    if (!isSupported) {
      throw new Error('Unsupported call')
    }
    const callHash = Payload.hashCall(call)
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
    { name: 'redirectUrlHash', type: 'bytes32', internalType: 'bytes32' },
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

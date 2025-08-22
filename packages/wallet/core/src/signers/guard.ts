import { Address, Bytes, TypedData, Signature } from 'ox'
import { Attestation, Payload } from '@0xsequence/wallet-primitives'
import * as GuardService from '@0xsequence/guard'
import * as Envelope from '../envelope.js'

export class Guard {
  constructor(private readonly guard: GuardService.Guard) {}

  async signEnvelope<T extends Payload.Payload>(envelope: Envelope.Signed<T>): Promise<Envelope.Signature> {
    // Important: guard must always sign without parent wallets, even if the payload is parented
    const unparentedPayload = {
      ...envelope.payload,
      parentWallets: undefined,
    }

    const payloadType = toGuardType(envelope.payload)
    const payloadData = toGuardPayload(envelope.wallet, envelope.chainId, unparentedPayload)
    const previousSignatures = envelope.signatures.map(toGuardSignature)

    const signature = await this.guard.signPayload(
      envelope.wallet,
      envelope.chainId,
      payloadType,
      payloadData,
      previousSignatures,
    )
    return {
      address: this.guard.address,
      signature: {
        type: 'hash',
        ...signature,
      },
    }
  }
}

function toGuardType(type: Payload.Payload): GuardService.PayloadType {
  switch (type.type) {
    case 'call':
      return GuardService.PayloadType.Calls
    case 'message':
      return GuardService.PayloadType.Message
    case 'config-update':
      return GuardService.PayloadType.ConfigUpdate
    case 'session-implicit-authorize':
      return GuardService.PayloadType.SessionImplicitAuthorize
  }
  throw new Error(`Payload type not supported by Guard: ${type.type}`)
}

function toGuardPayload(wallet: Address.Address, chainId: number, payload: Payload.Payload): Bytes.Bytes {
  if (Payload.isSessionImplicitAuthorize(payload)) {
    return Attestation.encode(payload.attestation)
  }
  const typedData = Payload.toTyped(wallet, chainId, payload)
  return Bytes.fromString(TypedData.serialize(typedData))
}

function toGuardSignature(signature: Envelope.Signature | Envelope.SapientSignature): GuardService.Signature {
  if (Envelope.isSapientSignature(signature)) {
    return {
      type: GuardService.SignatureType.Sapient,
      address: signature.signature.address,
      imageHash: signature.imageHash,
      data: signature.signature.data,
    }
  }

  if (signature.signature.type == 'erc1271') {
    return {
      type: GuardService.SignatureType.Erc1271,
      address: signature.signature.address,
      data: signature.signature.data,
    }
  }

  const type = {
    eth_sign: GuardService.SignatureType.EthSign,
    hash: GuardService.SignatureType.Hash,
  }[signature.signature.type]
  if (!type) {
    throw new Error(`Signature type not supported by Guard: ${signature.signature.type}`)
  }

  return {
    type,
    address: signature.address,
    data: Signature.toHex(signature.signature),
  }
}

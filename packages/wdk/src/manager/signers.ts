import { Address, Bytes, Hex } from 'ox'
import { State } from '@0xsequence/sequence-core'
import { Devices } from './devices'
import { Payload } from '@0xsequence/sequence-primitives'

export const Kinds = {
  LocalDevice: 'local-device',
  LoginPasskey: 'login-passkey',
  Unknown: 'unknown',
} as const

export type Kind = (typeof Kinds)[keyof typeof Kinds]

export type WitnessExtraSignerKind = {
  signerKind: string
}

export function isWitnessExtraSignerKind(extra: any): extra is WitnessExtraSignerKind {
  return typeof extra === 'object' && extra !== null && 'signerKind' in extra
}

function toKnownKind(kind: string): Kind {
  if (Object.values(Kinds).includes(kind as Kind)) {
    return kind as Kind
  }

  console.warn(`Unknown signer kind: ${kind}`)

  return Kinds.Unknown
}

// Signers is in charge to know (or figure out) the "kind" of each signer
// i.e., when a signature is requested, we only get address and imageHash (if sapient)
// this module takes care of figuring out the kind of signer (e.g., device, passkey, recovery, etc.)
export class Signers {
  constructor(
    private readonly devices: Devices,
    private readonly stateProvider: State.Provider,
  ) {}

  async kindOf(wallet: Address.Address, address: Address.Address, imageHash?: Hex.Hex): Promise<Kind | undefined> {
    // // The device may be among the local devices, in that case it is a local device
    // // TODO: Maybe signers shouldn't be getting in the way of devices, it feels like a
    // //      different concern
    // if (await this.devices.has(address)) {
    //   return Kinds.LocalDevice
    // }

    // We need to use the state provider (and witness) this will tell us the kind of signer
    // NOTICE: This looks expensive, but this operation should be cached by the state provider
    const witness = await (imageHash
      ? this.stateProvider.getWitnessForSapient(wallet, address, imageHash)
      : this.stateProvider.getWitnessFor(wallet, address))

    if (!witness) {
      return undefined
    }

    // Parse the payload, it may have the kind of signer
    if (!Payload.isMessage(witness.payload)) {
      return undefined
    }

    try {
      const message = JSON.parse(Bytes.toString(witness.payload.message))
      if (isWitnessExtraSignerKind(message)) {
        return toKnownKind(message.signerKind)
      }
    } catch {}

    return undefined
  }
}

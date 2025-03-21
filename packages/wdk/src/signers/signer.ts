import { Envelope } from '@0xsequence/sequence-core'
import * as Db from '../dbs'
import { Address, Hex } from 'ox'

export type InteractiveSignerStatus = {
  message: string

  // ready: the signer is ready to sign, without user interaction
  // actionable: the signer is ready to sign, but requires user interaction
  // unavailable: the signer is not available to sign
  status: 'ready' | 'actionable' | 'unavailable'
}

export interface InteractiveSigner {
  address: Address.Address
  imageHash?: Hex.Hex | undefined

  // Icon and text for the signing options screen
  icon(): string
  label(): string

  // Tells the signer to prepare for signing a given request
  prepare(request: Db.SignatureRequest): void

  // Extended sign method that allows for focus request
  sign(request: Db.SignatureRequest): Promise<Envelope.SapientSignature | Envelope.Signature>

  // Some signers may have different status per request
  // some others may have a global status. This pattern enables both.
  status(requestId?: string): InteractiveSignerStatus
}

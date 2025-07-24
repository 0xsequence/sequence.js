import { Envelope } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import { Handler } from '../handlers/handler.js'

export type ActionToPayload = {
  [Actions.Logout]: Payload.ConfigUpdate
  [Actions.RemoteLogout]: Payload.ConfigUpdate
  [Actions.Login]: Payload.ConfigUpdate
  [Actions.SendTransaction]: Payload.Calls | Payload.Calls4337_07
  [Actions.SignMessage]: Payload.Message
  [Actions.SessionUpdate]: Payload.ConfigUpdate
  [Actions.Recovery]: Payload.Recovery<Payload.Calls>
  [Actions.AddRecoverySigner]: Payload.ConfigUpdate
  [Actions.RemoveRecoverySigner]: Payload.ConfigUpdate
  [Actions.SessionImplicitAuthorize]: Payload.SessionImplicitAuthorize
}

export const Actions = {
  Logout: 'logout',
  RemoteLogout: 'remote-logout',
  Login: 'login',
  SendTransaction: 'send-transaction',
  SignMessage: 'sign-message',
  SessionUpdate: 'session-update',
  Recovery: 'recovery',
  AddRecoverySigner: 'add-recovery-signer',
  RemoveRecoverySigner: 'remove-recovery-signer',
  SessionImplicitAuthorize: 'session-implicit-authorize',
} as const

export type Action = (typeof Actions)[keyof typeof Actions]

/**
 * Represents the fundamental, stored state of a signature request.
 * This is the core object persisted in the database, containing the static details of what needs to be signed.
 *
 * @template A The specific action type, which determines the payload shape.
 */
export type BaseSignatureRequest<A extends Action = Action> =
  | {
      /** A unique identifier for the signature request (UUID v7). */
      id: string
      /** The address of the wallet this request is for. */
      wallet: Address.Address
      /** A string indicating the origin of the request (e.g., a dapp URL or 'wallet-webapp'). */
      origin: string
      /** The ISO 8601 timestamp of when the request was created. */
      createdAt: string

      /** The specific type of action being requested (e.g., 'send-transaction', 'login'). */
      action: A
      /**
       * The Sequence wallet envelope containing the payload to be signed, the wallet configuration,
       * and the list of collected signatures.
       */
      envelope: Envelope.Signed<ActionToPayload[A]>
      /** The current status of the request. 'pending' means it is active and awaiting signatures. */
      status: 'pending'
    }
  | {
      /** A unique identifier for the signature request (UUID v7). */
      id: string
      /** The address of the wallet this request is for. */
      wallet: Address.Address
      /** A string indicating the origin of the request (e.g., a dapp URL or 'wallet-webapp'). */
      origin: string
      /** The ISO 8601 timestamp of when the request was created. */
      createdAt: string

      /** The specific type of action being requested (e.g., 'send-transaction', 'login'). */
      action: A
      /**
       * The Sequence wallet envelope containing the payload to be signed, the wallet configuration,
       * and the list of collected signatures.
       */
      envelope: Envelope.Signed<ActionToPayload[A]>
      /** The terminal status of the request. It is no longer active. */
      status: 'cancelled' | 'completed'
      /**
       * A Unix timestamp (in milliseconds) indicating when this terminal request can be safely
       * removed from the database by the pruning job.
       */
      scheduledPruning: number
    }

/**
 * The most basic representation of a signer required for a `SignatureRequest`.
 */
export type SignerBase = {
  /** The address of the signer. */
  address: Address.Address
  /**
   * For sapient signers (e.g., passkeys, recovery modules), this is the hash of the
   * configuration tree that defines the signer's behavior, acting as a unique identifier.
   */
  imageHash?: Hex.Hex
}

/**
 * Represents a signer who has already provided their signature for the request.
 * The UI can show this signer as "completed".
 */
export type SignerSigned = SignerBase & {
  /** The handler associated with this signer's kind. */
  handler?: Handler
  /** The status of this signer, always 'signed'. */
  status: 'signed'
}

/**
 * Represents a signer that cannot currently provide a signature.
 * The UI can use the `reason` to inform the user why this option is disabled.
 */
export type SignerUnavailable = SignerBase & {
  /** The handler associated with this signer's kind, if one could be determined. */
  handler?: Handler
  /** A machine-readable string explaining why the signer is unavailable (e.g., 'not-local-key', 'ui-not-registered'). */
  reason: string
  /** The status of this signer, always 'unavailable'. */
  status: 'unavailable'
}

/**
 * Represents a signer that is immediately available to sign without any further user interaction.
 * This is typical for local device keys. The UI can present this as a simple "Sign" button.
 */
export type SignerReady = SignerBase & {
  /** The handler that will perform the signing. */
  handler: Handler
  /** The status of this signer, always 'ready'. */
  status: 'ready'
  /** A function to call to trigger the signing process. Returns `true` on success. */
  handle: () => Promise<boolean>
}

/**
 * Represents a signer that requires user interaction to provide a signature.
 * The UI should use the `message` to prompt the user for the appropriate action (e.g., enter OTP, use passkey).
 */
export type SignerActionable = SignerBase & {
  /** The handler that will manage the user interaction and signing flow. */
  handler: Handler
  /** The status of this signer, always 'actionable'. */
  status: 'actionable'
  /** A message key for the UI, indicating the required action (e.g., 'enter-mnemonic', 'request-interaction-with-passkey'). */
  message: string
  /** A function that initiates the user interaction flow. Returns `true` when the user successfully completes the action. */
  handle: () => Promise<boolean>
}

/**
 * A union type representing all possible states of a signer for a given signature request.
 * An array of these objects is used to build a dynamic signing UI.
 */
export type Signer = SignerSigned | SignerUnavailable | SignerReady | SignerActionable

/**
 * The "hydrated" signature request object, providing a complete, real-time view of the request's state.
 * It combines the static `BaseSignatureRequest` with dynamic information about the required signers.
 * This is the primary object used for building interactive signing UIs.
 */
export type SignatureRequest = BaseSignatureRequest & {
  /** The total weight of the signatures that have been collected so far. */
  weight: bigint
  /** The total weight required from signers to fulfill the request. */
  threshold: bigint
  /** An array containing the real-time status of every signer required for this request. */
  signers: Signer[]
}

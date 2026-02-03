import { State } from '@0xsequence/wallet-core'
import { Address, Hex } from 'ox'
import { Kinds } from '../types/signer.js'
import { Signatures } from '../signatures.js'
import { Config, Extensions } from '@0xsequence/wallet-primitives'
import { Handler } from './handler.js'
import { SignerActionable, SignerUnavailable, BaseSignatureRequest } from '../types/index.js'
import type { PasskeyProvider, PasskeySigner } from '../passkeys-provider.js'

export class PasskeysHandler implements Handler {
  kind = Kinds.LoginPasskey
  private readySigners = new Map<string, PasskeySigner>()

  constructor(
    private readonly signatures: Signatures,
    private readonly extensions: Pick<Extensions.Extensions, 'passkeys'>,
    private readonly stateReader: State.Reader,
    private readonly passkeyProvider: PasskeyProvider,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  public addReadySigner(signer: PasskeySigner) {
    // Use credentialId as key to match specific passkey instances
    this.readySigners.set(signer.credentialId, signer)
  }

  private async loadPasskey(wallet: Address.Address, imageHash: Hex.Hex): Promise<PasskeySigner | undefined> {
    try {
      return await this.passkeyProvider.loadFromWitness(this.stateReader, this.extensions, wallet, imageHash)
    } catch (e) {
      console.warn('Failed to load passkey:', e)
      return undefined
    }
  }

  async status(
    address: Address.Address,
    imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerActionable | SignerUnavailable> {
    const base = { address, imageHash, handler: this }
    if (address !== this.extensions.passkeys) {
      console.warn(
        'PasskeySigner: status address does not match passkey module address',
        address,
        this.extensions.passkeys,
      )
      const status: SignerUnavailable = {
        ...base,
        status: 'unavailable',
        reason: 'unknown-error',
      }
      return status
    }

    // First check if we have a ready signer that matches the imageHash
    let passkey: PasskeySigner | undefined

    // Look for a ready signer with matching imageHash
    for (const readySigner of this.readySigners.values()) {
      if (imageHash && readySigner.imageHash === imageHash) {
        passkey = readySigner
        break
      }
    }

    // If no ready signer found, fall back to loading from witness
    if (!passkey && imageHash) {
      passkey = await this.loadPasskey(request.envelope.wallet, imageHash)
    }

    if (!passkey) {
      console.warn('PasskeySigner: status failed to load passkey', address, imageHash)
      const status: SignerUnavailable = {
        ...base,
        status: 'unavailable',
        reason: 'unknown-error',
      }
      return status
    }

    // At this point, we know imageHash is defined because we have a passkey
    if (!imageHash) {
      throw new Error('imageHash is required for passkey operations')
    }

    const status: SignerActionable = {
      ...base,
      status: 'actionable',
      message: 'request-interaction-with-passkey',
      imageHash: imageHash,
      handle: async () => {
        const normalized = Config.normalizeSignerSignature(
          passkey.signSapient(request.envelope.wallet, request.envelope.chainId, request.envelope.payload, imageHash),
        )
        const signature = await normalized.signature
        await this.signatures.addSignature(request.id, {
          address,
          imageHash,
          signature,
        })
        return true
      },
    }
    return status
  }
}

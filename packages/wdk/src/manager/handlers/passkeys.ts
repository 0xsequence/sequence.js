import { Signers, State } from '@0xsequence/sequence-core'
import * as Db from '../../dbs'
import { Address, Bytes, Hex } from 'ox'
import { Kinds } from '../signers'
import { Signatures, SignerActionable, SignerUnavailable } from '../signatures'
import { Extensions } from '@0xsequence/sequence-primitives'
import { Handler } from '.'

export class PasskeysHandler implements Handler {
  kind = Kinds.LoginPasskey

  constructor(
    private readonly signatures: Signatures,
    private readonly extensions: Pick<Extensions.Extensions, 'passkeys'>,
    private readonly stateReader: State.Reader,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  private async loadPasskey(wallet: Address.Address, imageHash: Hex.Hex): Promise<Signers.Passkey.Passkey | undefined> {
    try {
      return await Signers.Passkey.Passkey.loadFromWitness(this.stateReader, this.extensions, wallet, imageHash)
    } catch (e) {
      console.warn('Failed to load passkey:', e)
      return undefined
    }
  }

  async status(
    address: Address.Address,
    imageHash: Hex.Hex | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerActionable | SignerUnavailable> {
    const base = { address, imageHash, handler: this }
    if (address !== this.extensions.passkeys) {
      console.warn(
        'PasskeySigner: status address does not match passkey module address',
        address,
        this.extensions.passkeys,
      )
      return {
        ...base,
        status: 'unavailable',
        reason: 'unknown-error',
      } as SignerUnavailable
    }

    const passkey = imageHash && (await this.loadPasskey(request.envelope.wallet, imageHash))
    if (!passkey) {
      console.warn('PasskeySigner: status failed to load passkey', address, imageHash)
      return {
        ...base,
        status: 'unavailable',
        reason: 'unknown-error',
      } as SignerUnavailable
    }

    return {
      ...base,
      status: 'actionable',
      message: 'request-interaction-with-passkey',
      handle: async () => {
        const signature = await passkey.signSapient(
          request.envelope.wallet,
          request.envelope.chainId,
          request.envelope.payload,
          imageHash,
        )
        await this.signatures.addSignature(request.id, {
          address,
          imageHash,
          signature,
        })
        return true
      },
    } as SignerActionable
  }
}

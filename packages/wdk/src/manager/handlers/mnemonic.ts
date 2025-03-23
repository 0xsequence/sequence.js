import * as Db from '../../dbs'
import { Kinds } from '../signers'
import { Signatures, SignerReady, SignerUnavailable } from '../signatures'
import { Address, Bytes, Hex, Mnemonic } from 'ox'
import { Handler } from '.'
import { Signers } from '@0xsequence/sequence-core'

export class MnemonicHandler implements Handler {
  kind = Kinds.LocalDevice

  private onPromptMnemonic: undefined | (() => Promise<{ mnemonic: string; error: (e: string) => void }>)

  constructor(private readonly signatures: Signatures) {}

  // uiStatus() {
  //   return this._uiStatus
  // }

  async status(
    address: Address.Address,
    _imageHash: Bytes.Bytes | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerUnavailable | SignerReady> {
    const onPromptMnemonic = this.onPromptMnemonic
    if (!onPromptMnemonic) {
      return {
        address,
        handler: this,
        reason: 'ui-not-registered',
        status: 'unavailable',
      }
    }

    return {
      address,
      handler: this,
      status: 'ready',
      sign: async () => {
        const { mnemonic, error } = await onPromptMnemonic()
        try {
          const pk = Mnemonic.toPrivateKey(mnemonic)
          const signer = new Signers.Pk.Pk(Hex.from(pk))
          if (signer.address !== address) {
            error('wrong-mnemonic')
            return false
          }

          const signature = await signer.sign(
            request.envelope.wallet,
            request.envelope.chainId,
            request.envelope.payload,
          )
          await this.signatures.addSignature(request.id, {
            address,
            signature,
          })
          return true
        } catch {
          error('invalid-mnemonic')
          return false
        }
      },
    }
  }
}

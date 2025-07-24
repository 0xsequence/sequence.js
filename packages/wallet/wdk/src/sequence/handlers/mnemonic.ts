import { Signers } from '@0xsequence/wallet-core'
import { Hex, Mnemonic } from 'ox'
import { Handler } from './handler.js'
import { Signatures } from '../signatures.js'
import { Kinds } from '../types/signer.js'
import { SignerReady, SignerUnavailable, BaseSignatureRequest, SignerActionable } from '../types/index.js'

type RespondFn = (mnemonic: string) => Promise<void>

export class MnemonicHandler implements Handler {
  kind = Kinds.LoginMnemonic

  private onPromptMnemonic: undefined | ((respond: RespondFn) => Promise<void>)

  constructor(private readonly signatures: Signatures) {}

  public registerUI(onPromptMnemonic: (respond: RespondFn) => Promise<void>) {
    this.onPromptMnemonic = onPromptMnemonic
    return () => {
      this.onPromptMnemonic = undefined
    }
  }

  public unregisterUI() {
    this.onPromptMnemonic = undefined
  }

  onStatusChange(_cb: () => void): () => void {
    return () => {}
  }

  public static toSigner(mnemonic: string): Signers.Pk.Pk | undefined {
    try {
      const pk = Mnemonic.toPrivateKey(mnemonic)
      return new Signers.Pk.Pk(Hex.from(pk))
    } catch {
      return undefined
    }
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerActionable> {
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
      status: 'actionable',
      message: 'enter-mnemonic',
      handle: () =>
        new Promise(async (resolve, reject) => {
          const respond = async (mnemonic: string) => {
            const signer = MnemonicHandler.toSigner(mnemonic)
            if (!signer) {
              return reject('invalid-mnemonic')
            }

            if (!Address.isEqual(signer.address, address)) {
              return reject('wrong-mnemonic')
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
            resolve(true)
          }
          await onPromptMnemonic(respond)
        }),
    }
  }
}

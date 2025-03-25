import { Signers } from '@0xsequence/sequence-core'
import { Address, Hex, Mnemonic } from 'ox'
import { Handler } from '.'
import * as Db from '../../dbs'
import { Signatures, SignerReady, SignerUnavailable } from '../signatures'
import { Kinds } from '../signers'

export class MnemonicHandler implements Handler {
  kind = Kinds.LoginMnemonic

  private onPromptMnemonic: undefined | (() => Promise<{ mnemonic: string; error: (e: string) => void }>)

  constructor(private readonly signatures: Signatures) {}

  public registerUI(onPromptMnemonic: () => Promise<{ mnemonic: string; error: (e: string) => void }>) {
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
      handle: async () => {
        const { mnemonic, error } = await onPromptMnemonic()
        const signer = MnemonicHandler.toSigner(mnemonic)
        if (!signer) {
          error('invalid-mnemonic')
          return false
        }

        if (signer.address !== address) {
          error('wrong-mnemonic')
          return false
        }

        const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
        await this.signatures.addSignature(request.id, {
          address,
          signature,
        })
        return true
      },
    }
  }
}

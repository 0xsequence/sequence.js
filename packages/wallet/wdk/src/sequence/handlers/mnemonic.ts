import { Signers } from '@0xsequence/wallet-core'
import { Address, Hex, Mnemonic } from 'ox'
import { Handler } from './handler.js'
import { Signatures } from '../signatures.js'
import { Kinds } from '../types/signer.js'
import { SignerReady, SignerUnavailable, BaseSignatureRequest, SignerActionable } from '../types/index.js'

type RespondFn = (mnemonic: string) => Promise<void>

export type PromptMnemonicHandler = (respond: RespondFn) => Promise<void>

export class MnemonicHandler implements Handler {
  kind = Kinds.LoginMnemonic

  private onPromptMnemonic: undefined | PromptMnemonicHandler
  private readySigners = new Map<Address.Address, Signers.Pk.Pk>()

  constructor(private readonly signatures: Signatures) {}

  public registerUI(onPromptMnemonic: PromptMnemonicHandler) {
    this.onPromptMnemonic = onPromptMnemonic
    return () => {
      this.onPromptMnemonic = undefined
    }
  }

  public unregisterUI() {
    this.onPromptMnemonic = undefined
  }

  public addReadySigner(signer: Signers.Pk.Pk) {
    this.readySigners.set(signer.address.toLowerCase() as Address.Address, signer)
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
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    // Check if we have a cached signer for this address
    const signer = this.readySigners.get(address.toLowerCase() as Address.Address)

    if (signer) {
      return {
        address,
        handler: this,
        status: 'ready',
        handle: async () => {
          const signature = await signer.sign(
            request.envelope.wallet,
            request.envelope.chainId,
            request.envelope.payload,
          )

          await this.signatures.addSignature(request.id, {
            address,
            signature,
          })

          // Remove the ready signer after use
          this.readySigners.delete(address.toLowerCase() as Address.Address)

          return true
        },
      }
    }

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
          const respond: RespondFn = async (mnemonic: string) => {
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

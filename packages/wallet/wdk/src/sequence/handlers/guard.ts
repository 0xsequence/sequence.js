import { Address, Hex } from 'ox'
import * as Guard from '@0xsequence/guard'
import { Handler } from './handler.js'
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable, Kinds } from '../types/index.js'
import { Signatures } from '../signatures.js'
import { GuardRole, Guards } from '../guards.js'

export class GuardHandler implements Handler {
  kind = Kinds.Guard

  private onPromptCode:
    | undefined
    | ((codeType: 'TOTP' | 'PIN', respond: (code: string) => Promise<void>) => Promise<void>)

  constructor(
    private readonly signatures: Signatures,
    private readonly guards: Guards,
  ) {}

  public registerUI(
    onPromptCode: (codeType: 'TOTP' | 'PIN', respond: (code: string) => Promise<void>) => Promise<void>,
  ) {
    this.onPromptCode = onPromptCode
    return () => {
      this.onPromptCode = undefined
    }
  }

  public unregisterUI() {
    this.onPromptCode = undefined
  }

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    const guardInfo = this.guards.getByAddress(address)
    if (!guardInfo) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'guard-not-found',
      }
    }

    const [role, guard] = guardInfo
    if (role !== 'wallet') {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'not-wallet-guard',
      }
    }

    const onPromptCode = this.onPromptCode
    if (!onPromptCode) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'guard-ui-not-registered',
      }
    }

    if (request.envelope.signatures.length === 0) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'must-not-sign-first',
      }
    }

    return {
      address,
      handler: this,
      status: 'ready',
      handle: () =>
        new Promise(async (resolve, reject) => {
          try {
            const signature = await guard.signEnvelope(request.envelope)
            await this.signatures.addSignature(request.id, signature)
            resolve(true)
          } catch (e) {
            if (e instanceof Guard.AuthRequiredError) {
              const respond = async (code: string) => {
                try {
                  const signature = await guard.signEnvelope(request.envelope, { id: e.id, code })
                  await this.signatures.addSignature(request.id, signature)
                  resolve(true)
                } catch (e) {
                  reject(e)
                }
              }

              await onPromptCode(e.id, respond)
            } else {
              reject(e)
            }
          }
        }),
    }
  }
}

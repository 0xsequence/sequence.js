import { Address, Hex } from 'ox'
import { Signers } from '@0xsequence/wallet-core'
import { Handler } from './handler.js'
import * as Identity from '@0xsequence/identity-instrument'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import { SignerActionable, SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types/signature-request.js'
import { IdentitySigner } from '../../identity/signer.js'
import { IdentityHandler } from './identity.js'
import { Kinds } from '../types/signer.js'
import type { WdkEnv } from '../../env.js'

type RespondFn = (idToken: string) => Promise<void>

export type PromptIdTokenHandler = (kind: 'google-id-token' | `custom-${string}`, respond: RespondFn) => Promise<void>

export class IdTokenHandler extends IdentityHandler implements Handler {
  private onPromptIdToken: undefined | PromptIdTokenHandler

  constructor(
    public readonly signupKind: 'google-id-token' | `custom-${string}`,
    public readonly issuer: string,
    public readonly audience: string,
    nitro: Identity.IdentityInstrument,
    signatures: Signatures,
    authKeys: Db.AuthKeys,
    env?: WdkEnv,
  ) {
    super(nitro, authKeys, signatures, Identity.IdentityType.OIDC, env)
  }

  public get kind() {
    if (this.signupKind === 'google-id-token') {
      return Kinds.LoginGoogle
    }
    return 'login-' + this.signupKind
  }

  public registerUI(onPromptIdToken: PromptIdTokenHandler) {
    this.onPromptIdToken = onPromptIdToken
    return () => {
      this.onPromptIdToken = undefined
    }
  }

  public unregisterUI() {
    this.onPromptIdToken = undefined
  }

  public async completeAuth(idToken: string): Promise<[IdentitySigner, { [key: string]: string }]> {
    const challenge = new Identity.IdTokenChallenge(this.issuer, this.audience, idToken)
    await this.nitroCommitVerifier(challenge)
    const { signer: identitySigner, email } = await this.nitroCompleteAuth(challenge)

    return [identitySigner, { email }]
  }

  public async getSigner(): Promise<{ signer: Signers.Signer & Signers.Witnessable; email: string }> {
    const onPromptIdToken = this.onPromptIdToken
    if (!onPromptIdToken) {
      throw new Error('id-token-handler-ui-not-registered')
    }

    return await this.handleAuth(onPromptIdToken)
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    const signer = await this.getAuthKeySigner(address)
    if (signer) {
      return {
        address,
        handler: this,
        status: 'ready',
        handle: async () => {
          await this.sign(signer, request)
          return true
        },
      }
    }

    const onPromptIdToken = this.onPromptIdToken
    if (!onPromptIdToken) {
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
      message: 'request-id-token',
      handle: async () => {
        try {
          const { signer } = await this.handleAuth(onPromptIdToken)
          const signerAddress = (await signer.address) as Address.Address
          if (!Address.isEqual(signerAddress, address)) {
            await this.clearAuthKeySigner(signerAddress)
            throw new Error('id-token-signer-mismatch')
          }
          return true
        } catch {
          return false
        }
      },
    }
  }

  private handleAuth(
    onPromptIdToken: PromptIdTokenHandler,
  ): Promise<{ signer: Signers.Signer & Signers.Witnessable; email: string }> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const respond: RespondFn = async (idToken) => {
          try {
            const [signer, metadata] = await this.completeAuth(idToken)
            resolve({ signer, email: metadata.email || '' })
          } catch (error) {
            reject(error)
          }
        }

        await onPromptIdToken(this.signupKind, respond)
      } catch (error) {
        reject(error)
      }
    })
  }
}

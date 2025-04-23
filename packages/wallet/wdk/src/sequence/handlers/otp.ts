import { Hex, Address } from 'ox'
import { Handler } from './handler.js'
import { Signers } from '@0xsequence/wallet-core'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js'
import { Kinds } from '../types/signer.js'
import * as Identity from '../../identity/index.js'
import { IdentityHandler } from './identity.js'

type RespondFn = (otp: string) => Promise<void>

export class OtpHandler extends IdentityHandler implements Handler {
  kind = Kinds.LoginEmailOtp

  private onPromptOtp: undefined | ((recipient: string, respond: RespondFn) => Promise<void>)

  constructor(nitro: Identity.IdentityInstrument, signatures: Signatures, authKeys: Db.AuthKeys) {
    super(nitro, authKeys, signatures)
  }

  public registerUI(onPromptOtp: (recipient: string, respond: RespondFn) => Promise<void>) {
    this.onPromptOtp = onPromptOtp
    return () => {
      this.onPromptOtp = undefined
    }
  }

  public unregisterUI() {
    this.onPromptOtp = undefined
  }

  public async getSigner(email: string): Promise<Signers.Signer & Signers.Witnessable> {
    const onPromptOtp = this.onPromptOtp
    if (!onPromptOtp) {
      throw new Error('otp-handler-ui-not-registered')
    }

    const challenge = Identity.OtpChallenge.fromRecipient(Identity.IdentityType.Email, email)
    const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge)

    return new Promise(async (resolve, reject) => {
      const respond = async (otp: string) => {
        try {
          const signer = await this.nitroCompleteAuth(challenge.withAnswer(codeChallenge, otp))
          resolve(signer)
        } catch (e) {
          reject(e)
        }
      }
      await onPromptOtp(loginHint, respond)
    })
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    const onPromptOtp = this.onPromptOtp
    if (!onPromptOtp) {
      return {
        address,
        handler: this,
        reason: 'ui-not-registered',
        status: 'unavailable',
      }
    }

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

    return {
      address,
      handler: this,
      status: 'actionable',
      message: 'request-otp',
      handle: () =>
        new Promise(async (resolve, reject) => {
          const challenge = Identity.OtpChallenge.fromSigner(Identity.IdentityType.Email, address)
          const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge)

          const respond = async (otp: string) => {
            try {
              await this.nitroCompleteAuth(challenge.withAnswer(codeChallenge, otp))
              resolve(true)
            } catch (e) {
              resolve(false)
              throw e
            }
          }

          await onPromptOtp(loginHint, respond)
        }),
    }
  }
}

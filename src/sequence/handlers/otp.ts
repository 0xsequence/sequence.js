import { Hex, Address } from 'ox'
import { Signers } from '@0xsequence/wallet-core'
import * as Identity from '@0xsequence/identity-instrument'
import { Handler } from './handler.js'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js'
import { Kinds } from '../types/signer.js'
import { IdentityHandler } from './identity.js'
import { AnswerIncorrectError, ChallengeExpiredError, TooManyAttemptsError } from '../errors.js'

type RespondFn = (otp: string) => Promise<void>

export class OtpHandler extends IdentityHandler implements Handler {
  kind = Kinds.LoginEmailOtp

  private onPromptOtp: undefined | ((recipient: string, respond: RespondFn) => Promise<void>)

  constructor(nitro: Identity.IdentityInstrument, signatures: Signatures, authKeys: Db.AuthKeys) {
    super(nitro, authKeys, signatures, Identity.IdentityType.Email)
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

  public async getSigner(email: string): Promise<{ signer: Signers.Signer & Signers.Witnessable; email: string }> {
    const onPromptOtp = this.onPromptOtp
    if (!onPromptOtp) {
      throw new Error('otp-handler-ui-not-registered')
    }

    const challenge = Identity.OtpChallenge.fromRecipient(this.identityType, email)
    return await this.handleAuth(challenge, onPromptOtp)
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

    const onPromptOtp = this.onPromptOtp
    if (!onPromptOtp) {
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
      message: 'request-otp',
      handle: async () => {
        const challenge = Identity.OtpChallenge.fromSigner(this.identityType, {
          address,
          keyType: Identity.KeyType.Ethereum_Secp256k1,
        })
        try {
          await this.handleAuth(challenge, onPromptOtp)
          return true
        } catch (e) {
          return false
        }
      },
    }
  }

  private handleAuth(
    challenge: Identity.OtpChallenge,
    onPromptOtp: (recipient: string, respond: RespondFn) => Promise<void>,
  ): Promise<{ signer: Signers.Signer & Signers.Witnessable; email: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const { loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge)

        const respond = async (otp: string) => {
          try {
            const { signer, email: returnedEmail } = await this.nitroCompleteAuth(
              challenge.withAnswer(codeChallenge, otp),
            )
            resolve({ signer, email: returnedEmail })
          } catch (e) {
            if (e instanceof Identity.Client.AnswerIncorrectError) {
              // Keep the handle promise unresolved so that respond can be retried
              throw new AnswerIncorrectError()
            } else if (e instanceof Identity.Client.ChallengeExpiredError) {
              reject(e)
              throw new ChallengeExpiredError()
            } else if (e instanceof Identity.Client.TooManyAttemptsError) {
              reject(e)
              throw new TooManyAttemptsError()
            } else {
              reject(e)
            }
          }
        }

        await onPromptOtp(loginHint, respond)
      } catch (e) {
        reject(e)
      }
    })
  }
}

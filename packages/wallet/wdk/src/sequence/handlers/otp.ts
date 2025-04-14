import { Hex, Address } from 'ox'
import { Handler } from '.'
import { Signers } from '@0xsequence/wallet-core'
import * as Db from '../../dbs'
import { Signatures } from '../signatures'
import { SignerUnavailable, SignerReady, SignerActionable } from '../types'
import { Kinds } from '../signers'
import * as Identity from '../../identity'

type RespondFn = (otp: string) => Promise<void>

export class OtpHandler implements Handler {
  kind = Kinds.LoginEmailOtp

  private onPromptOtp: undefined | ((recipient: string, respond: RespondFn) => Promise<void>)
  private statusChangeListeners: (() => void)[] = []

  constructor(
    private readonly nitro: Identity.IdentityInstrument,
    private readonly signatures: Signatures,
  ) {}

  public registerUI(onPromptOtp: (recipient: string, respond: RespondFn) => Promise<void>) {
    this.onPromptOtp = onPromptOtp
    return () => {
      this.onPromptOtp = undefined
    }
  }

  public unregisterUI() {
    this.onPromptOtp = undefined
  }

  public onStatusChange(cb: () => void): () => void {
    this.statusChangeListeners.push(cb)
    return () => {
      this.statusChangeListeners = this.statusChangeListeners.filter((l) => l !== cb)
    }
  }

  public async getSigner(email: string): Promise<Signers.Signer & Signers.Witnessable> {
    const onPromptOtp = this.onPromptOtp
    if (!onPromptOtp) {
      throw new Error('otp-handler-ui-not-registered')
    }

    const wdk = new Identity.Wdk('694', this.nitro)
    const challenge = Identity.OtpChallenge.fromRecipient(Identity.IdentityType.Email, email)
    const { loginHint, challenge: codeChallenge } = await wdk.initiateAuth(challenge)

    return new Promise(async (resolve, reject) => {
      const respond = async (otp: string) => {
        try {
          const signer = await wdk.completeAuth(challenge.withAnswer(codeChallenge, otp))
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
    request: Db.SignatureRequest,
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

    const wdk = new Identity.Wdk('694', this.nitro)
    const signer = await wdk.getSigner() // TODO: specify which signer
    if (signer && signer.address === address) {
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
          const { loginHint, challenge: codeChallenge } = await wdk.initiateAuth(challenge)

          const respond = async (otp: string) => {
            try {
              await wdk.completeAuth(challenge.withAnswer(codeChallenge, otp))
              this.notifyStatusChange()
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

  private notifyStatusChange() {
    this.statusChangeListeners.forEach((l) => l())
  }
}

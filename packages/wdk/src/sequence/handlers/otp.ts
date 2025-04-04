import { Hex, Address } from 'ox'
import { Handler } from '.'
import { Signers } from '@0xsequence/sequence-core'
import * as Db from '../../dbs'
import { Signatures } from '../signatures'
import { SignerUnavailable, SignerReady, SignerActionable } from '../types'
import { Kinds } from '../signers'
import * as Identity from '../../identity'

export class OtpHandler implements Handler {
  kind = Kinds.LoginEmailOtp

  private onPromptOtp: undefined | ((recipient: string) => Promise<{ otp: string; error: (e: string) => void }>)

  constructor(
    private readonly nitro: Identity.IdentityInstrument,
    private readonly signatures: Signatures,
  ) {}

  public registerUI(onPromptOtp: (recipient: string) => Promise<{ otp: string; error: (e: string) => void }>) {
    this.onPromptOtp = onPromptOtp
    return () => {
      this.onPromptOtp = undefined
    }
  }

  public unregisterUI() {
    this.onPromptOtp = undefined
  }

  public onStatusChange(cb: () => void): () => void {
    // TODO: keep track of signer validity and call cb when it changes
    return () => {}
  }

  public async getSigner(email: string): Promise<Signers.Signer & Signers.Witnessable> {
    if (!this.onPromptOtp) {
      throw new Error('otp-handler-ui-not-registered')
    }

    const wdk = new Identity.Wdk('694', this.nitro)
    const challenge = Identity.OtpChallenge.fromRecipient(Identity.IdentityType.Email, email)
    const { loginHint, challenge: codeChallenge } = await wdk.initiateAuth(challenge)
    const { otp, error } = await this.onPromptOtp(loginHint)
    try {
      const signer = await wdk.completeAuth(challenge.withAnswer(codeChallenge, otp))
      return signer
    } catch (e) {
      error('invalid-otp')
      throw e
    }
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
        status: 'actionable',
        message: 'request-otp',
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
      status: 'ready',
      handle: async () => {
        const challenge = Identity.OtpChallenge.fromSigner(Identity.IdentityType.Email, address)
        const { loginHint, challenge: codeChallenge } = await wdk.initiateAuth(challenge)
        const { otp, error } = await onPromptOtp(loginHint)
        try {
          await wdk.completeAuth(challenge.withAnswer(codeChallenge, otp))
          return true
        } catch (e) {
          console.error(e)
          error('invalid-otp')
          return false
        }
      },
    }
  }
}

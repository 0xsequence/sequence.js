import { Hex, Address, Bytes } from 'ox'
import { Handler } from '.'
import * as Db from '../../dbs'
import { Signatures } from '../signatures'
import * as Identity from '../../identity'
import { SignerUnavailable, SignerReady, SignerActionable } from '../types'
import { AuthCommitment } from '../../dbs'

export class AuthCodePkceHandler implements Handler {
  private redirectUri: string = ''

  constructor(
    public readonly signupKind: 'google-pkce' | 'apple-pkce',
    private readonly issuer: string,
    private readonly audience: string,
    private readonly nitro: Identity.IdentityInstrument,
    private readonly signatures: Signatures,
    private readonly commitments: Db.AuthCommitments,
  ) {}

  public get kind() {
    return 'login-' + this.signupKind
  }

  public setRedirectUri(redirectUri: string) {
    this.redirectUri = redirectUri
  }

  public onStatusChange(cb: () => void): () => void {
    // TODO: keep track of signer validity and call cb when it changes
    return () => {}
  }

  public async commitAuth(target: string, isSignUp: boolean, state?: string, signer?: string) {
    const wdk = new Identity.Wdk('694', this.nitro)
    let challenge = new Identity.AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    if (signer) {
      challenge = challenge.withSigner(signer)
    }
    const { verifier, loginHint, challenge: codeChallenge } = await wdk.initiateAuth(challenge)
    if (!state) {
      state = Hex.fromBytes(Bytes.random(32))
    }

    await this.commitments.set({
      id: state,
      kind: this.signupKind,
      verifier,
      challenge: codeChallenge,
      target,
      metadata: {},
      isSignUp,
    })

    const searchParams = new URLSearchParams({
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      client_id: this.audience,
      redirect_uri: this.redirectUri,
      login_hint: loginHint,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    })

    const oauthUrl = this.oauthUrl()
    return `${oauthUrl}?${searchParams.toString()}`
  }

  public async completeAuth(
    commitment: AuthCommitment,
    code: string,
  ): Promise<[Identity.IdentitySigner, { [key: string]: string }]> {
    const wdk = new Identity.Wdk('694', this.nitro)
    const challenge = new Identity.AuthCodePkceChallenge('', '', '')
    const signer = await wdk.completeAuth(challenge.withAnswer(commitment.verifier, code))
    await this.commitments.del(commitment.id)
    return [signer, commitment.metadata]
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
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
      message: 'request-redirect',
      handle: async () => {
        const url = await this.commitAuth(window.location.pathname, false, request.id, address.toString())
        window.location.href = url
        return true
      },
    }
  }

  private oauthUrl() {
    switch (this.issuer) {
      case 'https://accounts.google.com':
        return 'https://accounts.google.com/o/oauth2/v2/auth'
      case 'https://appleid.apple.com':
        return 'https://appleid.apple.com/auth/authorize'
      default:
        throw new Error('unsupported-issuer')
    }
  }
}

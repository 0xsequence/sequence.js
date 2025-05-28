import { Hex, Address, Bytes } from 'ox'
import { Handler } from './handler.js'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import * as Identity from '@0xsequence/identity-instrument'
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js'
import { IdentitySigner } from '../../identity/signer.js'
import { IdentityHandler } from './identity.js'

export class AuthCodeHandler extends IdentityHandler implements Handler {
  protected redirectUri: string = ''

  constructor(
    public readonly signupKind: 'apple' | 'google-pkce',
    public readonly issuer: string,
    public readonly audience: string,
    nitro: Identity.IdentityInstrument,
    signatures: Signatures,
    protected readonly commitments: Db.AuthCommitments,
    authKeys: Db.AuthKeys,
  ) {
    super(nitro, authKeys, signatures, Identity.IdentityType.OIDC)
  }

  public get kind() {
    return 'login-' + this.signupKind
  }

  public setRedirectUri(redirectUri: string) {
    this.redirectUri = redirectUri
  }

  public async commitAuth(target: string, isSignUp: boolean, state?: string, signer?: string) {
    if (!state) {
      state = Hex.fromBytes(Bytes.random(32))
    }

    await this.commitments.set({
      id: state,
      kind: this.signupKind,
      signer,
      target,
      metadata: {},
      isSignUp,
    })

    const searchParams = new URLSearchParams({
      client_id: this.audience,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid',
      state,
    })

    const oauthUrl = this.oauthUrl()
    return `${oauthUrl}?${searchParams.toString()}`
  }

  public async completeAuth(
    commitment: Db.AuthCommitment,
    code: string,
  ): Promise<[IdentitySigner, { [key: string]: string }]> {
    let challenge = new Identity.AuthCodeChallenge(this.issuer, this.audience, this.redirectUri, code)
    if (commitment.signer) {
      challenge = challenge.withSigner({ address: commitment.signer, keyType: Identity.KeyType.Secp256k1 })
    }
    await this.nitroCommitVerifier(challenge)
    const signer = await this.nitroCompleteAuth(challenge)

    return [signer, {}]
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

    return {
      address,
      handler: this,
      status: 'actionable',
      message: 'request-redirect',
      handle: async () => {
        const url = await this.commitAuth(window.location.pathname, false, request.id, address)
        window.location.href = url
        return true
      },
    }
  }

  protected oauthUrl() {
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

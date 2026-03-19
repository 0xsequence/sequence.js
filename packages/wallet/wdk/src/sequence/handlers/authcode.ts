import { Hex, Address, Bytes } from 'ox'
import { Handler } from './handler.js'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import * as Identity from '@0xsequence/identity-instrument'
import { SignerUnavailable, SignerReady, SignerActionable, BaseSignatureRequest } from '../types/signature-request.js'
import { IdentitySigner } from '../../identity/signer.js'
import { IdentityHandler } from './identity.js'
import { Kinds } from '../types/signer.js'
import type { NavigationLike, WdkEnv } from '../../env.js'
import type { CommitAuthArgs } from '../../dbs/auth-commitments.js'

export class AuthCodeHandler extends IdentityHandler implements Handler {
  protected redirectUri: string = ''

  constructor(
    public readonly signupKind: 'apple' | 'google-pkce' | `custom-${string}`,
    public readonly issuer: string,
    protected readonly oauthUrl: string,
    public readonly audience: string,
    nitro: Identity.IdentityInstrument,
    signatures: Signatures,
    protected readonly commitments: Db.AuthCommitments,
    authKeys: Db.AuthKeys,
    env?: WdkEnv,
  ) {
    super(nitro, authKeys, signatures, Identity.IdentityType.OIDC, env)
  }

  public get kind() {
    if (this.signupKind === 'google-pkce') {
      // Keep Google PKCE on the canonical kind so Google signers created before
      // canonicalization still resolve as `login-google`.
      return Kinds.LoginGoogle
    }
    return 'login-' + this.signupKind
  }

  public setRedirectUri(redirectUri: string) {
    this.redirectUri = redirectUri
  }

  public async commitAuth(target: string, args: CommitAuthArgs) {
    const state = args.state ?? Hex.fromBytes(Bytes.random(32))

    const base = {
      id: state,
      kind: this.signupKind as Db.AuthCommitment['kind'],
      target,
      metadata: {},
    }

    if (args.type === 'reauth') {
      await this.commitments.set({ ...base, type: 'reauth', signer: args.signer })
    } else if (args.type === 'add-signer') {
      await this.commitments.set({ ...base, type: 'add-signer', wallet: args.wallet })
    } else {
      await this.commitments.set({ ...base, type: 'auth' })
    }

    const searchParams = this.serializeQuery({
      client_id: this.audience,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      ...(this.signupKind === 'apple' ? {} : { scope: 'openid profile email' }),
    })

    return `${this.oauthUrl}?${searchParams}`
  }

  public async completeAuth(
    commitment: Db.AuthCommitment,
    code: string,
  ): Promise<[IdentitySigner, { [key: string]: string }]> {
    let challenge = new Identity.AuthCodeChallenge(this.issuer, this.audience, this.redirectUri, code)
    if (commitment.type === 'reauth') {
      challenge = challenge.withSigner({ address: commitment.signer, keyType: Identity.KeyType.Ethereum_Secp256k1 })
    }
    await this.nitroCommitVerifier(challenge)
    const { signer, email } = await this.nitroCompleteAuth(challenge)

    return [signer, { email }]
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
        const navigation = this.getNavigation()
        const url = await this.commitAuth(navigation.getPathname(), {
          type: 'reauth',
          state: request.id,
          signer: address,
        })
        navigation.redirect(url)
        return true
      },
    }
  }

  protected serializeQuery(params: Record<string, string>): string {
    const searchParamsCtor = this.env.urlSearchParams ?? (globalThis as any).URLSearchParams
    if (searchParamsCtor) {
      return new searchParamsCtor(params).toString()
    }
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
  }

  private getNavigation(): NavigationLike {
    const navigation = this.env.navigation
    if (!navigation) {
      throw new Error('navigation is not available')
    }
    return navigation
  }
}

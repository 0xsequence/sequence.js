import { Hex, Bytes } from 'ox'
import { Handler } from './handler.js'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import * as Identity from '@0xsequence/identity-instrument'
import { IdentitySigner } from '../../identity/signer.js'
import { AuthCodeHandler } from './authcode.js'

export class AuthCodePkceHandler extends AuthCodeHandler implements Handler {
  constructor(
    signupKind: 'google-pkce',
    issuer: string,
    audience: string,
    nitro: Identity.IdentityInstrument,
    signatures: Signatures,
    commitments: Db.AuthCommitments,
    authKeys: Db.AuthKeys,
  ) {
    super(signupKind, issuer, audience, nitro, signatures, commitments, authKeys)
  }

  public async commitAuth(target: string, isSignUp: boolean, state?: string, signer?: string) {
    let challenge = new Identity.AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    if (signer) {
      challenge = challenge.withSigner({ address: signer, keyType: Identity.KeyType.Secp256k1 })
    }
    const { verifier, loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge)
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
    commitment: Db.AuthCommitment,
    code: string,
  ): Promise<[IdentitySigner, { [key: string]: string }]> {
    const challenge = new Identity.AuthCodePkceChallenge('', '', '')
    if (!commitment.verifier) {
      throw new Error('Missing verifier in commitment')
    }
    const { signer, email } = await this.nitroCompleteAuth(challenge.withAnswer(commitment.verifier, code))

    await this.commitments.del(commitment.id)

    return [signer, { ...commitment.metadata, email }]
  }
}

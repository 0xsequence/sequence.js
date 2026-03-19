import { Hex, Bytes } from 'ox'
import { Handler } from './handler.js'
import * as Db from '../../dbs/index.js'
import { Signatures } from '../signatures.js'
import * as Identity from '@0xsequence/identity-instrument'
import { IdentitySigner } from '../../identity/signer.js'
import { AuthCodeHandler } from './authcode.js'
import type { WdkEnv } from '../../env.js'
import type { CommitAuthArgs } from '../../dbs/auth-commitments.js'

export class AuthCodePkceHandler extends AuthCodeHandler implements Handler {
  constructor(
    signupKind: 'google-pkce' | `custom-${string}`,
    issuer: string,
    oauthUrl: string,
    audience: string,
    nitro: Identity.IdentityInstrument,
    signatures: Signatures,
    commitments: Db.AuthCommitments,
    authKeys: Db.AuthKeys,
    env?: WdkEnv,
  ) {
    super(signupKind, issuer, oauthUrl, audience, nitro, signatures, commitments, authKeys, env)
  }

  public async commitAuth(target: string, args: CommitAuthArgs) {
    let challenge = new Identity.AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    if (args.type === 'reauth') {
      challenge = challenge.withSigner({ address: args.signer, keyType: Identity.KeyType.Ethereum_Secp256k1 })
    }
    const { verifier, loginHint, challenge: codeChallenge } = await this.nitroCommitVerifier(challenge)
    const state = args.state ?? Hex.fromBytes(Bytes.random(32))

    const base = {
      id: state,
      kind: this.signupKind as Db.AuthCommitment['kind'],
      verifier,
      challenge: codeChallenge,
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
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      client_id: this.audience,
      redirect_uri: this.redirectUri,
      login_hint: loginHint,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    })

    return `${this.oauthUrl}?${searchParams}`
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

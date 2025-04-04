import { Challenge, IdTokenChallenge, AuthCodePkceChallenge, OtpChallenge } from './challenge'
import { IdentityInstrument, IdentityType } from './nitro'
import { AuthKey } from './authkey'
import { IdentitySigner } from './signer'
import { getDefaultSecureStoreBackend } from './secure-store'
import { Hex } from 'ox'

interface OAuthParams {
  pkceMethod: 'S256' | 'none'
  oauthUrl: string
  issuer: string
  audience: string
  clientId: string
  redirectUri: string
  state?: string
}

interface OAuthState {
  verifier: string
  params: OAuthParams
}

export class Wdk {
  constructor(
    readonly ecosystemId: string,
    readonly nitro: IdentityInstrument,
  ) {}

  public async loginWithOtp(
    identityType: IdentityType,
    recipient: string,
    callback: (respondToChallenge: (code: string) => Promise<void>) => void,
  ) {
    const challenge = OtpChallenge.fromRecipient(identityType, recipient)
    const { challenge: codeChallenge } = await this.initiateAuth(challenge)

    return new Promise<IdentitySigner>((resolve, reject) => {
      const respondToChallenge = async (code: string) => {
        try {
          const signer = await this.completeAuth(challenge.withAnswer(codeChallenge, code))
          resolve(signer)
        } catch (error) {
          reject(error)
        }
      }
      callback(respondToChallenge)
    })
  }

  public async loginWithIdToken(issuer: string, audience: string, idToken: string) {
    const challenge = new IdTokenChallenge(issuer, audience, idToken)
    await this.initiateAuth(challenge)
    return await this.completeAuth(challenge)
  }

  public async loginWithOAuthRedirect(params: OAuthParams) {
    if (params.pkceMethod !== 'S256') {
      // TODO: support 'none'
      throw new Error('PKCE method not supported')
    }

    const challenge = new AuthCodePkceChallenge(params.issuer, params.audience, params.redirectUri)
    const { verifier, loginHint, challenge: codeChallenge } = await this.initiateAuth(challenge)
    const state = params.state || Hex.random(32)
    const stateJson = JSON.stringify({ verifier, loginHint, params })

    sessionStorage.setItem(state, stateJson)

    const searchParams = new URLSearchParams({
      code_challenge: codeChallenge,
      code_challenge_method: params.pkceMethod,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    })
    return `${params.oauthUrl}?${searchParams.toString()}`
  }

  public async completeOAuthLogin(state: string, code: string) {
    const stateJson = sessionStorage.getItem(state)
    if (!stateJson) {
      throw new Error('Invalid state')
    }
    const {
      verifier,
      params: { issuer, audience, redirectUri },
    } = JSON.parse(stateJson) as OAuthState
    const challenge = new AuthCodePkceChallenge(issuer, audience, redirectUri)
    const signer = await this.completeAuth(challenge.withAnswer(verifier, code))
    sessionStorage.removeItem(state)
    return signer
  }

  public async getSigner() {
    const authKey = await this.getAuthKey()
    if (!authKey.identitySigner) {
      throw new Error('No signer address found')
    }
    return new IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }

  public async initiateAuth(challenge: Challenge) {
    const authKey = await this.getAuthKey()
    const params = {
      ...challenge.getCommitParams(),
      ecosystem: this.ecosystemId,
      authKey: authKey.toProto(),
    }
    const res = await this.nitro.commitVerifier({ params })
    return res
  }

  public async completeAuth(challenge: Challenge) {
    const authKey = await this.getAuthKey()
    const params = {
      ...challenge.getCompleteParams(),
      ecosystem: this.ecosystemId,
      authKey: authKey.toProto(),
    }
    const res = await this.nitro.completeAuth({ params })
    await authKey.setIdentitySigner(res.signer as `0x${string}`)
    return new IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }

  private async getAuthKey() {
    const backend = getDefaultSecureStoreBackend()
    if (!backend) {
      throw new Error('No secure store backend available')
    }
    const authKey = await AuthKey.fromStorage(backend)
    if (!authKey) {
      return await AuthKey.createRandom(backend)
    }
    return authKey
  }
}

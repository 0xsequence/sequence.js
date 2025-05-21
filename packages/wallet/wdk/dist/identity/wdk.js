'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Wdk = void 0
const challenge_1 = require('./challenge')
const authkey_1 = require('./authkey')
const signer_1 = require('./signer')
const secure_store_1 = require('./secure-store')
const ox_1 = require('ox')
class Wdk {
  ecosystemId
  nitro
  constructor(ecosystemId, nitro) {
    this.ecosystemId = ecosystemId
    this.nitro = nitro
  }
  async loginWithOtp(identityType, recipient, callback) {
    const challenge = challenge_1.OtpChallenge.fromRecipient(identityType, recipient)
    const { challenge: codeChallenge } = await this.initiateAuth(challenge)
    return new Promise((resolve, reject) => {
      const respondToChallenge = async (code) => {
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
  async loginWithIdToken(issuer, audience, idToken) {
    const challenge = new challenge_1.IdTokenChallenge(issuer, audience, idToken)
    await this.initiateAuth(challenge)
    return await this.completeAuth(challenge)
  }
  async loginWithOAuthRedirect(params) {
    if (params.pkceMethod !== 'S256') {
      // TODO: support 'none'
      throw new Error('PKCE method not supported')
    }
    const challenge = new challenge_1.AuthCodePkceChallenge(params.issuer, params.audience, params.redirectUri)
    const { verifier, loginHint, challenge: codeChallenge } = await this.initiateAuth(challenge)
    const state = params.state || ox_1.Hex.random(32)
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
  async completeOAuthLogin(state, code) {
    const stateJson = sessionStorage.getItem(state)
    if (!stateJson) {
      throw new Error('Invalid state')
    }
    const {
      verifier,
      params: { issuer, audience, redirectUri },
    } = JSON.parse(stateJson)
    const challenge = new challenge_1.AuthCodePkceChallenge(issuer, audience, redirectUri)
    const signer = await this.completeAuth(challenge.withAnswer(verifier, code))
    sessionStorage.removeItem(state)
    return signer
  }
  async getSigner() {
    const authKey = await this.getAuthKey()
    if (!authKey.identitySigner) {
      throw new Error('No signer address found')
    }
    return new signer_1.IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }
  async initiateAuth(challenge) {
    const authKey = await this.getAuthKey()
    const params = {
      ...challenge.getCommitParams(),
      ecosystem: this.ecosystemId,
      authKey: authKey.toProto(),
    }
    const res = await this.nitro.commitVerifier({ params })
    return res
  }
  async completeAuth(challenge) {
    const authKey = await this.getAuthKey()
    const params = {
      ...challenge.getCompleteParams(),
      ecosystem: this.ecosystemId,
      authKey: authKey.toProto(),
    }
    const res = await this.nitro.completeAuth({ params })
    await authKey.setIdentitySigner(res.signer)
    return new signer_1.IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }
  async getAuthKey() {
    const backend = (0, secure_store_1.getDefaultSecureStoreBackend)()
    if (!backend) {
      throw new Error('No secure store backend available')
    }
    const authKey = await authkey_1.AuthKey.fromStorage(backend)
    if (!authKey) {
      return await authkey_1.AuthKey.createRandom(backend)
    }
    return authKey
  }
}
exports.Wdk = Wdk

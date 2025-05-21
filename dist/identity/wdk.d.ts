import { Challenge } from './challenge'
import { IdentityInstrument, IdentityType } from './nitro'
import { IdentitySigner } from './signer'
interface OAuthParams {
  pkceMethod: 'S256' | 'none'
  oauthUrl: string
  issuer: string
  audience: string
  clientId: string
  redirectUri: string
  state?: string
}
export declare class Wdk {
  readonly ecosystemId: string
  readonly nitro: IdentityInstrument
  constructor(ecosystemId: string, nitro: IdentityInstrument)
  loginWithOtp(
    identityType: IdentityType,
    recipient: string,
    callback: (respondToChallenge: (code: string) => Promise<void>) => void,
  ): Promise<IdentitySigner>
  loginWithIdToken(issuer: string, audience: string, idToken: string): Promise<IdentitySigner>
  loginWithOAuthRedirect(params: OAuthParams): Promise<string>
  completeOAuthLogin(state: string, code: string): Promise<IdentitySigner>
  getSigner(): Promise<IdentitySigner>
  initiateAuth(challenge: Challenge): Promise<import('./nitro').CommitVerifierReturn>
  completeAuth(challenge: Challenge): Promise<IdentitySigner>
  private getAuthKey
}
export {}
//# sourceMappingURL=wdk.d.ts.map

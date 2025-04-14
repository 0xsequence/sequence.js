import { Hex, Bytes, Signature, PersonalMessage } from 'ox'
import { Identity } from '@0xsequence/sequence-wdk'

export interface AttestationParams {
  sessionAddress: string
  ecosystemId: string
  identityType: string
  appId: string
  issuer?: string
  audience?: string
  redirectUri: string
}

export class Attestation {
  private constructor(
    public readonly message: string,
    public readonly signature: string,
  ) {}

  static async create(signer: Identity.IdentitySigner, params: AttestationParams) {
    const attestationMessage = [
      `SessionAddress=${params.sessionAddress}`,
      `EcosystemID=${params.ecosystemId}`,
      `AppID=${params.appId}`,
      `IdentityType=${params.identityType}`,
      params.issuer ? `Issuer=${params.issuer}` : null,
      params.audience ? `Audience=${params.audience}` : null,
      `RedirectURI=${params.redirectUri}`,
    ]
      .filter(Boolean)
      .join('; ')

    const personalMessage = PersonalMessage.getSignPayload(Hex.fromString(attestationMessage))
    const attestationSignature = await signer.signDigest(Bytes.fromHex(personalMessage))

    if (attestationSignature.type !== 'hash') {
      throw new Error('Invalid signature type')
    }

    const sig = Signature.toHex({
      r: attestationSignature.r,
      s: attestationSignature.s,
      yParity: attestationSignature.yParity,
    })

    return new Attestation(attestationMessage, sig)
  }
}

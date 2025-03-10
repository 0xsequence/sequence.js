'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'
import { PersonalMessage, Hex, Bytes, Signature } from 'ox'
import { Identity } from '@0xsequence/sequence-wdk'
import type { ClientParams } from '../lib/client-params'

interface Props {
  nitroRpc: string
  idToken: string
  ecosystemId: string
  issuer: string
  audience: string
  clientParams: ClientParams
}

export default function IdTokenHandler({ nitroRpc, idToken, ecosystemId, issuer, audience, clientParams }: Props) {
  useEffect(() => {
    ;(async () => {
      const wdk = new Identity.Wdk(ecosystemId, new Identity.IdentityInstrument(nitroRpc, window.fetch))
      const signer = await wdk.loginWithIdToken(issuer, audience, idToken)

      // We have the signer, now we can use it to sign a message
      console.log(signer)

      const attestationMessage = [
        `SessionAddress=${clientParams.sessionAddress}`,
        `EcosystemID=${ecosystemId}`,
        `AppID=${clientParams.appId}`,
        `IdentityType=OIDC`,
        `Issuer=${issuer}`,
        `Audience=${audience}`,
        `RedirectURI=${clientParams.redirectUri}`,
      ].join('; ')

      const personalMessage = PersonalMessage.getSignPayload(Hex.fromString(attestationMessage))
      const attestationSignature = await signer.signDigest(Bytes.fromHex(personalMessage))
      console.log({ attestationSignature, attestationMessage })

      if (attestationSignature.type !== 'hash') {
        throw new Error('Invalid signature type')
      }

      const sig = Signature.toHex({
        r: attestationSignature.r,
        s: attestationSignature.s,
        yParity: attestationSignature.yParity,
      })

      const returnParams = new URLSearchParams({
        attestation_signature: sig,
        attestation_message: attestationMessage,
        state: clientParams.state,
        session_address: clientParams.sessionAddress,
      })

      redirect(`${clientParams.redirectUri}?${returnParams.toString()}`)
    })()
  }, [
    nitroRpc,
    idToken,
    ecosystemId,
    issuer,
    audience,
    clientParams.sessionAddress,
    clientParams.appId,
    clientParams.redirectUri,
    clientParams.state,
  ])

  return <div>Signing in...</div>
}

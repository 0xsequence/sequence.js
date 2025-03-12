'use client'

import { useEffect } from 'react'
import { Identity } from '@0xsequence/sequence-wdk'
import { redirect } from 'next/navigation'
import { Hex } from 'ox'
import { Bytes } from 'ox'
import { PersonalMessage } from 'ox'
import { Signature } from 'ox'
import { ClientParams } from '../lib/client-params'
import { storeClientParams, getClientParams } from '../lib/session-storage'

interface InitParams {
  type: 'init'
  clientId: string
  redirectUri: string
  oauthUrl: string
  clientParams: ClientParams
  state: string
}

interface CallbackParams {
  type: 'callback'
  code: string
  state: string
}

type OAuthParams = InitParams | CallbackParams

interface Props {
  nitroRpc: string
  ecosystemId: string
  issuer: string
  audience: string
  oauthParams: OAuthParams
}

export default function AuthCodePkceHandler({ nitroRpc, ecosystemId, issuer, audience, oauthParams }: Props) {
  useEffect(() => {
    ;(async () => {
      const wdk = new Identity.Wdk(ecosystemId, new Identity.IdentityInstrument(nitroRpc, window.fetch))
      if (oauthParams.type === 'init') {
        await storeClientParams(oauthParams.state, oauthParams.clientParams)
        const url = await wdk.loginWithOAuthRedirect({
          pkceMethod: 'S256',
          oauthUrl: oauthParams.oauthUrl,
          issuer,
          audience,
          clientId: oauthParams.clientId,
          redirectUri: oauthParams.redirectUri,
          state: oauthParams.state,
        })
        redirect(url)
      } else {
        const clientParams = await getClientParams(oauthParams.state)
        const signer = await wdk.completeOAuthLogin(oauthParams.state, oauthParams.code)

        // We have the signer, now we can use it to sign a message
        console.log(signer)

        const attestationMessage = [
          `SessionAddress=${clientParams.session_address}`,
          `EcosystemID=${ecosystemId}`,
          `AppID=${clientParams.app_id}`,
          `IdentityType=OIDC`,
          `Issuer=${issuer}`,
          `Audience=${audience}`,
          `RedirectURI=${clientParams.redirect_uri}`,
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
          session_address: clientParams.session_address,
        })

        redirect(`${clientParams.redirect_uri}?${returnParams.toString()}`)
      }
    })()
  }, [])

  return <div>Signing in...</div>
}

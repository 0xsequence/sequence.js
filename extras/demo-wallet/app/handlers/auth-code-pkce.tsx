'use client'

import { useEffect } from 'react'
import { Identity } from '@0xsequence/wallet-wdk'
import { redirect } from 'next/navigation'
import { ClientParams } from '../lib/client-params'
import { storeClientParams, getClientParams } from '../lib/session-storage'
import { Attestation } from '../lib/attestation'

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
        console.log({ signer })

        const attestation = await Attestation.create(signer, {
          sessionAddress: clientParams.session_address,
          ecosystemId,
          appId: clientParams.app_id,
          identityType: 'OIDC',
          issuer,
          audience,
          redirectUri: clientParams.redirect_uri,
        })
        console.log({ attestation })

        const returnParams = new URLSearchParams({
          attestation_signature: attestation.signature,
          attestation_message: attestation.message,
          state: clientParams.state,
          session_address: clientParams.session_address,
        })

        redirect(`${clientParams.redirect_uri}?${returnParams.toString()}`)
      }
    })()
  }, [])

  return <div>Signing in...</div>
}

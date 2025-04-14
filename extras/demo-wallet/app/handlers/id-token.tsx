'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'
import { Identity } from '@0xsequence/sequence-wdk'
import type { ClientParams } from '../lib/client-params'
import { Attestation } from '../lib/attestation'

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
        attestation_message: attestation.message,
        attestation_signature: attestation.signature,
        state: clientParams.state,
        session_address: clientParams.session_address,
      })

      redirect(`${clientParams.redirect_uri}?${returnParams.toString()}`)
    })()
  }, [
    nitroRpc,
    idToken,
    ecosystemId,
    issuer,
    audience,
    clientParams.session_address,
    clientParams.app_id,
    clientParams.redirect_uri,
    clientParams.state,
  ])

  return <div>Signing in...</div>
}

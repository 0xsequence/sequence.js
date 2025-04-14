'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { Identity } from '@0xsequence/wallet-wdk'
import type { ClientParams } from '../lib/client-params'
import { Attestation } from '../lib/attestation'

interface Props {
  nitroRpc: string
  ecosystemId: string
  identityType: Identity.IdentityType
  recipient: string
  clientParams: ClientParams
}

export default function OtpHandler({ nitroRpc, ecosystemId, identityType, recipient, clientParams }: Props) {
  const wdk = new Identity.Wdk(ecosystemId, new Identity.IdentityInstrument(nitroRpc, window.fetch))

  const [code, setCode] = useState('')
  const [respondToChallenge, setRespondToChallenge] = useState<((code: string) => Promise<void>) | null>(null)

  useEffect(() => {
    ;(async () => {
      if (respondToChallenge) {
        return
      }

      const signer = await wdk.loginWithOtp(identityType, recipient, (respondToChallenge) => {
        setRespondToChallenge(() => respondToChallenge)
      })

      // We have the signer, now we can use it to sign a message
      console.log({ signer })

      const attestation = await Attestation.create(signer, {
        sessionAddress: clientParams.session_address,
        ecosystemId,
        appId: clientParams.app_id,
        identityType,
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
  }, [])

  return (
    <div>
      <input type="text" value={code} onChange={(e) => setCode(e.target.value)} />
      {respondToChallenge && <button onClick={() => respondToChallenge(code)}>Submit</button>}
    </div>
  )
}

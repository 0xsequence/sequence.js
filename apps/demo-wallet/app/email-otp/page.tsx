'use server'

import OtpHandler from '../handlers/otp'
import { ClientParams } from '../lib/client-params'
import { Identity } from '@0xsequence/sequence-wdk'

type EmailParams = ClientParams & {
  email: string
}

export default async function EmailOtp({ searchParams }: { searchParams: Promise<EmailParams> }) {
  const params = await searchParams

  return (
    <OtpHandler
      nitroRpc={process.env.NITRO_RPC!}
      ecosystemId={process.env.ECOSYSTEM_ID!}
      identityType={Identity.IdentityType.Email}
      recipient={params.email}
      clientParams={params}
    />
  )
}

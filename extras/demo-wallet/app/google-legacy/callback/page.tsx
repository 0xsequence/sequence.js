'use server'

import { cookies, headers } from 'next/headers'
import IdTokenHandler from '../../handlers/id-token'
import { getClientParams } from '../../lib/cookies'

const googleClientId = process.env.GOOGLE_CLIENT_ID!
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET!

interface SearchParams {
  code: string
  state: string
}

export default async function GoogleCallback({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cookieStore = await cookies()
  const tokenEndpoint = 'https://oauth2.googleapis.com/token'
  const query = await searchParams

  // Get the origin from headers
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  const params = new URLSearchParams({
    client_id: googleClientId,
    client_secret: googleClientSecret,
    code: query.code,
    redirect_uri: `${origin}/google/callback`,
    grant_type: 'authorization_code',
    code_verifier: cookieStore.get('google-verifier')?.value!,
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const tokenRes = await response.json()

  const clientParams = await getClientParams(query.state)
  return (
    <IdTokenHandler
      idToken={tokenRes.id_token}
      nitroRpc={process.env.NITRO_RPC!}
      ecosystemId={process.env.ECOSYSTEM_ID!}
      issuer="https://accounts.google.com"
      audience={googleClientId}
      clientParams={clientParams}
    />
  )
}

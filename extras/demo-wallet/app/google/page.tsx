'use server'

import { headers } from 'next/headers'
import AuthCodePkceHandler from '../handlers/auth-code-pkce'
import { Hex } from 'ox'
import { ClientParams } from '../lib/client-params'

export default async function Google({ searchParams }: { searchParams: Promise<ClientParams> }) {
  // Get the origin from headers
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  return (
    <AuthCodePkceHandler
      nitroRpc={process.env.NITRO_RPC!}
      ecosystemId={process.env.ECOSYSTEM_ID!}
      issuer="https://accounts.google.com"
      audience={process.env.GOOGLE_CLIENT_ID!}
      oauthParams={{
        type: 'init',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        redirectUri: `${origin}/google/callback`,
        oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientParams: await searchParams,
        state: Hex.random(32),
      }}
    />
  )
}

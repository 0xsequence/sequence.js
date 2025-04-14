'use server'

import AuthCodePkceHandler from '../../handlers/auth-code-pkce'

interface SearchParams {
  code: string
  state: string
}

export default async function GoogleCallback({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams

  return (
    <AuthCodePkceHandler
      nitroRpc={process.env.NITRO_RPC!}
      ecosystemId={process.env.ECOSYSTEM_ID!}
      issuer="https://accounts.google.com"
      audience={process.env.GOOGLE_CLIENT_ID!}
      oauthParams={{
        type: 'callback',
        code: query.code,
        state: query.state,
      }}
    />
  )
}

'use server'

import { randomBytes, createHash } from 'crypto'
import { cookies } from 'next/headers'
import { storeClientParams } from '../lib/cookies'

const googleClientId = process.env.GOOGLE_CLIENT_ID!

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cookieStore = await cookies()
  const state = 'google-' + generateRandomString(32)

  // TODO: validate client params
  await storeClientParams(state, url.searchParams)

  const verifier = generateRandomString(128)
  const codeChallenge = await generateCodeChallenge(verifier)
  cookieStore.set(`google-verifier`, verifier)

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: `${url.origin}/google/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce: generateRandomString(32),
    state,
  })
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}

function generateRandomString(length: number) {
  const array = randomBytes(length)
  return array.toString('base64url')
}

async function generateCodeChallenge(verifier: string) {
  const hash = createHash('sha256').update(verifier).digest()
  return hash.toString('base64url')
}

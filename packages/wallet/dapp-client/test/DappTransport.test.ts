import { describe, expect, it } from 'vitest'

import { DappTransport } from '../src/DappTransport.js'
import { TransportMode } from '../src/types/index.js'

const encodeBase64Utf8 = (value: string) => {
  let binary = ''
  for (const byte of new TextEncoder().encode(value)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const decodeBase64Utf8 = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

const createSessionStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

describe('DappTransport redirect URLs', () => {
  it('encodes unicode payloads as UTF-8 base64', async () => {
    const transport = new DappTransport('https://wallet.example', TransportMode.REDIRECT, {}, createSessionStorage())
    const payload = { message: 'Sign in to Sequence 🌍' }

    const redirectUrl = await transport.getRequestRedirectUrl('signMessage', payload, 'https://dapp.example/callback')
    const parsedUrl = new URL(redirectUrl)
    const encodedPayload = parsedUrl.searchParams.get('payload')

    if (!encodedPayload) {
      throw new Error('Expected redirect URL to include a payload')
    }
    expect(parsedUrl.searchParams.get('encoding')).toBe('utf-8')
    expect(JSON.parse(decodeBase64Utf8(encodedPayload))).toEqual(payload)
  })

  it('decodes unicode redirect response payloads', async () => {
    const storage = createSessionStorage()
    const transport = new DappTransport('https://wallet.example', TransportMode.REDIRECT, {}, storage)
    const requestUrl = await transport.getRequestRedirectUrl('signMessage', {}, 'https://dapp.example/callback')
    const id = new URL(requestUrl).searchParams.get('id')
    const payload = { message: 'Signed by Sequence 🌍' }
    const responseUrl = new URL('https://dapp.example/callback')

    if (!id) {
      throw new Error('Expected redirect URL to include an id')
    }
    responseUrl.searchParams.set('id', id)
    responseUrl.searchParams.set('payload', encodeBase64Utf8(JSON.stringify(payload)))
    responseUrl.searchParams.set('encoding', 'utf-8')

    await expect(transport.getRedirectResponse(false, responseUrl.toString())).resolves.toEqual({
      action: 'signMessage',
      payload,
    })
  })

  it('decodes legacy Latin-1 redirect response payloads', async () => {
    const storage = createSessionStorage()
    const transport = new DappTransport('https://wallet.example', TransportMode.REDIRECT, {}, storage)
    const requestUrl = await transport.getRequestRedirectUrl('signMessage', {}, 'https://dapp.example/callback')
    const id = new URL(requestUrl).searchParams.get('id')
    const payload = { message: 'Signed by Sequence Café' }
    const responseUrl = new URL('https://dapp.example/callback')

    if (!id) {
      throw new Error('Expected redirect URL to include an id')
    }
    responseUrl.searchParams.set('id', id)
    responseUrl.searchParams.set('payload', btoa(JSON.stringify(payload)))

    await expect(transport.getRedirectResponse(false, responseUrl.toString())).resolves.toEqual({
      action: 'signMessage',
      payload,
    })
  })

  it('preserves legacy Latin-1 payloads with UTF-8 byte patterns (e.g. Ã©)', async () => {
    const storage = createSessionStorage()
    const transport = new DappTransport('https://wallet.example', TransportMode.REDIRECT, {}, storage)
    const requestUrl = await transport.getRequestRedirectUrl('signMessage', {}, 'https://dapp.example/callback')
    const id = new URL(requestUrl).searchParams.get('id')
    const payload = { message: 'Ã©' }
    const responseUrl = new URL('https://dapp.example/callback')

    if (!id) {
      throw new Error('Expected redirect URL to include an id')
    }
    responseUrl.searchParams.set('id', id)
    responseUrl.searchParams.set('payload', btoa(JSON.stringify(payload)))

    await expect(transport.getRedirectResponse(false, responseUrl.toString())).resolves.toEqual({
      action: 'signMessage',
      payload,
    })
  })
})

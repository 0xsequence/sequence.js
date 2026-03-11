import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hash, Hex, Mnemonic, Secp256k1, Address as OxAddress } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { newManager } from './constants.js'
import { Manager } from '../src/sequence/index.js'
import { Kinds } from '../src/sequence/types/signer.js'

describe('Sessions ID token attestation', () => {
  let manager: Manager | undefined

  afterEach(async () => {
    await manager?.stop()
  })

  it('Should include issuer and audience hashes for google-id-token implicit session authorization', async () => {
    manager = newManager({
      identity: {
        google: {
          enabled: true,
          clientId: 'test-google-client-id',
          authMethod: 'id-token',
        },
      },
    })

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    const signersModule = (manager as any).shared.modules.signers
    vi.spyOn(signersModule, 'kindOf').mockResolvedValue(Kinds.LoginGoogleIdToken)

    const sessionAddress = OxAddress.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
    const requestId = await manager.sessions.prepareAuthorizeImplicitSession(wallet!, sessionAddress, {
      target: 'https://example.com',
      applicationData: '0x1234',
    })

    const request = await manager.signatures.get(requestId)
    expect(request.action).toBe('session-implicit-authorize')
    expect(Payload.isSessionImplicitAuthorize(request.envelope.payload)).toBe(true)

    if (!Payload.isSessionImplicitAuthorize(request.envelope.payload)) {
      throw new Error('Expected session implicit authorize payload')
    }

    const attestation = request.envelope.payload.attestation
    expect(Hex.fromBytes(attestation.issuerHash)).toBe(Hash.keccak256(Hex.fromString('https://accounts.google.com')))
    expect(Hex.fromBytes(attestation.audienceHash)).toBe(Hash.keccak256(Hex.fromString('test-google-client-id')))
    expect(Hex.fromBytes(attestation.applicationData)).toBe('0x1234')
    expect(Hex.fromBytes(attestation.identityType)).toBe('0x00000002')
  })
})

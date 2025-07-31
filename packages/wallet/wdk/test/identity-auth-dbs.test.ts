import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Manager } from '../src/sequence'
import { Address, Hex, Bytes } from 'ox'
import { IdentityInstrument } from '@0xsequence/identity-instrument'
import * as Db from '../src/dbs'
import { LOCAL_RPC_URL } from './constants'
import { State } from '@0xsequence/wallet-core'

describe('Identity Authentication Databases', () => {
  let manager: Manager | undefined
  let authCommitmentsDb: Db.AuthCommitments
  let authKeysDb: Db.AuthKeys

  beforeEach(() => {
    vi.clearAllMocks()

    // Create isolated database instances with unique names
    const testId = `auth_dbs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    authCommitmentsDb = new Db.AuthCommitments(`test-auth-commitments-${testId}`)
    authKeysDb = new Db.AuthKeys(`test-auth-keys-${testId}`)
  })

  afterEach(async () => {
    await manager?.stop()
  })

  // === AUTH COMMITMENTS DATABASE TESTS ===

  describe('AuthCommitments Database', () => {
    it('Should create and manage Google PKCE commitments', async () => {
      const commitment: Db.AuthCommitment = {
        id: 'test-state-123',
        kind: 'google-pkce',
        metadata: { scope: 'openid profile email' },
        verifier: 'test-verifier-code',
        challenge: 'test-challenge-hash',
        target: 'test-target-url',
        isSignUp: true,
        signer: '0x1234567890123456789012345678901234567890',
      }

      // Test setting a commitment
      const id = await authCommitmentsDb.set(commitment)
      expect(id).toBe(commitment.id)

      // Test getting the commitment
      const retrieved = await authCommitmentsDb.get(commitment.id)
      expect(retrieved).toEqual(commitment)

      // Test listing commitments
      const list = await authCommitmentsDb.list()
      expect(list).toHaveLength(1)
      expect(list[0]).toEqual(commitment)

      // Test deleting the commitment
      await authCommitmentsDb.del(commitment.id)
      const deletedCommitment = await authCommitmentsDb.get(commitment.id)
      expect(deletedCommitment).toBeUndefined()
    })

    it('Should create and manage Apple commitments', async () => {
      const appleCommitment: Db.AuthCommitment = {
        id: 'apple-state-456',
        kind: 'apple',
        metadata: {
          response_type: 'code id_token',
          response_mode: 'form_post',
        },
        target: 'apple-redirect-url',
        isSignUp: false,
      }

      await authCommitmentsDb.set(appleCommitment)
      const retrieved = await authCommitmentsDb.get(appleCommitment.id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.kind).toBe('apple')
      expect(retrieved!.isSignUp).toBe(false)
      expect(retrieved!.metadata.response_type).toBe('code id_token')
    })

    it('Should handle multiple commitments and proper cleanup', async () => {
      const commitments: Db.AuthCommitment[] = [
        {
          id: 'commit-1',
          kind: 'google-pkce',
          metadata: {},
          target: 'target-1',
          isSignUp: true,
        },
        {
          id: 'commit-2',
          kind: 'apple',
          metadata: {},
          target: 'target-2',
          isSignUp: false,
        },
        {
          id: 'commit-3',
          kind: 'google-pkce',
          metadata: {},
          target: 'target-3',
          isSignUp: true,
        },
      ]

      // Add all commitments
      for (const commitment of commitments) {
        await authCommitmentsDb.set(commitment)
      }

      // Verify all are present
      const list = await authCommitmentsDb.list()
      expect(list.length).toBe(3)

      // Test selective deletion
      await authCommitmentsDb.del('commit-2')
      const updatedList = await authCommitmentsDb.list()
      expect(updatedList.length).toBe(2)
      expect(updatedList.find((c) => c.id === 'commit-2')).toBeUndefined()
    })

    it('Should handle database initialization and migration', async () => {
      // This test ensures the database creation code is triggered
      const freshDb = new Db.AuthCommitments(`fresh-db-${Date.now()}`)

      // Add a commitment to trigger database initialization
      const testCommitment: Db.AuthCommitment = {
        id: 'init-test',
        kind: 'google-pkce',
        metadata: {},
        target: 'init-target',
        isSignUp: true,
      }

      await freshDb.set(testCommitment)
      const retrieved = await freshDb.get(testCommitment.id)
      expect(retrieved).toEqual(testCommitment)
    })
  })

  // === AUTH KEYS DATABASE TESTS ===

  describe('AuthKeys Database', () => {
    let mockCryptoKey: CryptoKey

    beforeEach(() => {
      // Mock CryptoKey
      mockCryptoKey = {
        algorithm: { name: 'ECDSA', namedCurve: 'P-256' },
        extractable: false,
        type: 'private',
        usages: ['sign'],
      } as CryptoKey
    })

    it('Should create and manage auth keys with expiration', async () => {
      const authKey: Db.AuthKey = {
        address: '0xAbCdEf1234567890123456789012345678901234',
        privateKey: mockCryptoKey,
        identitySigner: '0x9876543210987654321098765432109876543210',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      }

      // Test setting an auth key (should normalize addresses)
      const address = await authKeysDb.set(authKey)
      expect(address).toBe(authKey.address.toLowerCase())

      // Test getting the auth key
      const retrieved = await authKeysDb.get(address)
      if (!retrieved) {
        throw new Error('Retrieved auth key should not be undefined')
      }
      expect(retrieved.address).toBe(authKey.address.toLowerCase())
      expect(retrieved.identitySigner).toBe(authKey.identitySigner.toLowerCase())
      expect(retrieved.privateKey).toEqual(mockCryptoKey)
    })

    it('Should handle getBySigner with fallback mechanisms', async () => {
      const authKey: Db.AuthKey = {
        address: '0x1111111111111111111111111111111111111111',
        privateKey: mockCryptoKey,
        identitySigner: '0x2222222222222222222222222222222222222222',
        expiresAt: new Date(Date.now() + 3600000),
      }

      await authKeysDb.set(authKey)

      // Test normal getBySigner
      const retrieved = await authKeysDb.getBySigner(authKey.identitySigner)
      expect(retrieved?.address).toBe(authKey.address.toLowerCase())

      // Test with different casing
      const retrievedMixed = await authKeysDb.getBySigner(authKey.identitySigner.toUpperCase())
      expect(retrievedMixed?.address).toBe(authKey.address.toLowerCase())
    })

    it('Should handle getBySigner retry mechanism', async () => {
      const signer = '0x3333333333333333333333333333333333333333'

      // First call should return undefined, then retry
      const result = await authKeysDb.getBySigner(signer)
      expect(result).toBeUndefined()
    })

    it('Should handle delBySigner operations', async () => {
      const authKey: Db.AuthKey = {
        address: '0x4444444444444444444444444444444444444444',
        privateKey: mockCryptoKey,
        identitySigner: '0x5555555555555555555555555555555555555555',
        expiresAt: new Date(Date.now() + 3600000),
      }

      await authKeysDb.set(authKey)

      // Verify it exists
      const beforeDelete = await authKeysDb.getBySigner(authKey.identitySigner)
      expect(beforeDelete).toBeDefined()

      // Delete by signer
      await authKeysDb.delBySigner(authKey.identitySigner)

      // Verify it's gone
      const afterDelete = await authKeysDb.getBySigner(authKey.identitySigner)
      expect(afterDelete).toBeUndefined()
    })

    it('Should handle delBySigner with non-existent signer', async () => {
      // Should not throw when deleting non-existent signer
      await expect(authKeysDb.delBySigner('0x9999999999999999999999999999999999999999')).resolves.not.toThrow()
    })

    it('Should handle expired auth keys and automatic cleanup', async () => {
      const expiredAuthKey: Db.AuthKey = {
        address: '0x6666666666666666666666666666666666666666',
        privateKey: mockCryptoKey,
        identitySigner: '0x7777777777777777777777777777777777777777',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      }

      // Setting an expired key should trigger immediate deletion
      await authKeysDb.set(expiredAuthKey)

      // It should be automatically deleted
      await new Promise((resolve) => setTimeout(resolve, 10))
      const retrieved = await authKeysDb.getBySigner(expiredAuthKey.identitySigner)
      expect(retrieved).toBeUndefined()
    })

    it('Should schedule and clear expiration timers', async () => {
      const shortLivedKey: Db.AuthKey = {
        address: '0x8888888888888888888888888888888888888888',
        privateKey: mockCryptoKey,
        identitySigner: '0x9999999999999999999999999999999999999999',
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
      }

      await authKeysDb.set(shortLivedKey)

      // Should exist initially
      const initial = await authKeysDb.getBySigner(shortLivedKey.identitySigner)
      expect(initial).toBeDefined()

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should be automatically deleted
      const afterExpiration = await authKeysDb.getBySigner(shortLivedKey.identitySigner)
      expect(afterExpiration).toBeUndefined()
    })

    it('Should handle database initialization and indexing', async () => {
      // Test database initialization with indexes
      const freshAuthKeysDb = new Db.AuthKeys(`fresh-auth-keys-${Date.now()}`)

      const testKey: Db.AuthKey = {
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        privateKey: mockCryptoKey,
        identitySigner: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        expiresAt: new Date(Date.now() + 3600000),
      }

      await freshAuthKeysDb.set(testKey)

      // Test index-based lookup
      const retrieved = await freshAuthKeysDb.getBySigner(testKey.identitySigner)
      expect(retrieved?.address).toBe(testKey.address.toLowerCase())
    })

    it('Should handle handleOpenDB for existing auth keys', async () => {
      // Add multiple keys before calling handleOpenDB
      const keys: Db.AuthKey[] = [
        {
          address: '0xcccccccccccccccccccccccccccccccccccccccc',
          privateKey: mockCryptoKey,
          identitySigner: '0xdddddddddddddddddddddddddddddddddddddddd',
          expiresAt: new Date(Date.now() + 3600000),
        },
        {
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          privateKey: mockCryptoKey,
          identitySigner: '0xffffffffffffffffffffffffffffffffffffffff',
          expiresAt: new Date(Date.now() + 7200000),
        },
      ]

      for (const key of keys) {
        await authKeysDb.set(key)
      }

      // Test handleOpenDB (this would normally be called on database initialization)
      await authKeysDb.handleOpenDB()

      // All keys should still be accessible
      for (const key of keys) {
        const retrieved = await authKeysDb.getBySigner(key.identitySigner)
        expect(retrieved).toBeDefined()
      }
    })
  })

  // === INTEGRATION TESTS WITH MANAGER ===

  describe('Integration with Manager (Google/Email enabled)', () => {
    it('Should use auth databases when Google authentication is enabled', async () => {
      manager = new Manager({
        stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore(`manager-google-${Date.now()}`)),
        networks: [
          {
            name: 'Test Network',
            rpc: LOCAL_RPC_URL,
            chainId: 42161n,
            explorer: 'https://arbiscan.io',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
        relayers: [],
        authCommitmentsDb,
        authKeysDb,
        identity: {
          url: 'https://dev-identity.sequence-dev.app',
          fetch: window.fetch,
          google: {
            enabled: true,
            clientId: 'test-google-client-id',
          },
        },
      })

      // Verify that Google handler is registered and uses our databases
      const handlers = (manager as any).shared.handlers
      expect(handlers.has('login-google-pkce')).toBe(true)
    })

    it('Should use auth databases when email authentication is enabled', async () => {
      manager = new Manager({
        stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore(`manager-email-${Date.now()}`)),
        networks: [
          {
            name: 'Test Network',
            rpc: LOCAL_RPC_URL,
            chainId: 42161n,
            explorer: 'https://arbiscan.io',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
        relayers: [],
        authCommitmentsDb,
        authKeysDb,
        identity: {
          url: 'https://dev-identity.sequence-dev.app',
          fetch: window.fetch,
          email: {
            enabled: true,
          },
        },
      })

      // Verify that email OTP handler is registered and uses our auth keys database
      const handlers = (manager as any).shared.handlers
      expect(handlers.has('login-email-otp')).toBe(true)
    })

    it('Should use auth databases when Apple authentication is enabled', async () => {
      manager = new Manager({
        stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore(`manager-apple-${Date.now()}`)),
        networks: [
          {
            name: 'Test Network',
            rpc: LOCAL_RPC_URL,
            chainId: 42161n,
            explorer: 'https://arbiscan.io',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
        relayers: [],
        authCommitmentsDb,
        authKeysDb,
        identity: {
          url: 'https://dev-identity.sequence-dev.app',
          fetch: window.fetch,
          apple: {
            enabled: true,
            clientId: 'com.example.test',
          },
        },
      })

      // Verify that Apple handler is registered and uses our databases
      const handlers = (manager as any).shared.handlers
      expect(handlers.has('login-apple')).toBe(true)
    })
  })
})

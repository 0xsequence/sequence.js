import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes, PublicKey, Secp256k1 } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { Pk, MemoryPkStore, PkStore } from '../src/signers/pk/index.js'
import { State } from '../src/index.js'

describe('Private Key Signers', () => {
  const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex.Hex
  const testWallet = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address.Address
  const testChainId = 42161n

  describe('MemoryPkStore', () => {
    let memoryStore: MemoryPkStore

    beforeEach(() => {
      memoryStore = new MemoryPkStore(testPrivateKey)
    })

    it('Should derive correct address from private key', () => {
      const address = memoryStore.address()
      const expectedAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: testPrivateKey }))

      expect(address).toBe(expectedAddress)
    })

    it('Should derive correct public key from private key', () => {
      const publicKey = memoryStore.publicKey()
      const expectedPublicKey = Secp256k1.getPublicKey({ privateKey: testPrivateKey })

      expect(publicKey).toEqual(expectedPublicKey)
    })

    it('Should sign digest correctly', async () => {
      const testDigest = Bytes.fromString('test message')
      const signature = await memoryStore.signDigest(testDigest)

      expect(signature).toHaveProperty('r')
      expect(signature).toHaveProperty('s')
      expect(signature).toHaveProperty('yParity')
      expect(typeof signature.r).toBe('bigint')
      expect(typeof signature.s).toBe('bigint')
      expect([0, 1]).toContain(signature.yParity)
    })
  })

  describe('Pk Class', () => {
    describe('Constructor', () => {
      it('Should construct with private key hex string', () => {
        const pk = new Pk(testPrivateKey)

        expect(pk.address).toBeDefined()
        expect(pk.pubKey).toBeDefined()
        expect(typeof pk.address).toBe('string')
        expect(pk.address.startsWith('0x')).toBe(true)
      })

      it('Should construct with PkStore instance', () => {
        const store = new MemoryPkStore(testPrivateKey)
        const pk = new Pk(store)

        expect(pk.address).toBe(store.address())
        expect(pk.pubKey).toEqual(store.publicKey())
      })

      it('Should set correct address and public key properties', () => {
        const pk = new Pk(testPrivateKey)
        const expectedPubKey = Secp256k1.getPublicKey({ privateKey: testPrivateKey })
        const expectedAddress = Address.fromPublicKey(expectedPubKey)

        expect(pk.pubKey).toEqual(expectedPubKey)
        expect(pk.address).toBe(expectedAddress)
      })
    })

    describe('Signing Methods', () => {
      let pk: Pk
      let testPayload: any

      beforeEach(() => {
        pk = new Pk(testPrivateKey)
        testPayload = Payload.fromMessage(Hex.fromString('Test signing message'))
      })

      it('Should sign payload correctly', async () => {
        const signature = await pk.sign(testWallet, testChainId, testPayload)

        expect(signature).toHaveProperty('type', 'hash')
        // Type assertion since we know it's a hash signature
        const hashSig = signature as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        expect(hashSig).toHaveProperty('r')
        expect(hashSig).toHaveProperty('s')
        expect(hashSig).toHaveProperty('yParity')
        expect(typeof hashSig.r).toBe('bigint')
        expect(typeof hashSig.s).toBe('bigint')
      })

      it('Should sign digest directly', async () => {
        const testDigest = Bytes.fromString('direct digest test')
        const signature = await pk.signDigest(testDigest)

        expect(signature).toHaveProperty('type', 'hash')
        const hashSig = signature as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        expect(hashSig).toHaveProperty('r')
        expect(hashSig).toHaveProperty('s')
        expect(hashSig).toHaveProperty('yParity')
      })

      it('Should produce consistent signatures for same input', async () => {
        const sig1 = await pk.sign(testWallet, testChainId, testPayload)
        const sig2 = await pk.sign(testWallet, testChainId, testPayload)

        const hashSig1 = sig1 as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        const hashSig2 = sig2 as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        expect(hashSig1.r).toBe(hashSig2.r)
        expect(hashSig1.s).toBe(hashSig2.s)
        expect(hashSig1.yParity).toBe(hashSig2.yParity)
      })

      it('Should produce different signatures for different inputs', async () => {
        const payload1 = Payload.fromMessage(Hex.fromString('Message 1'))
        const payload2 = Payload.fromMessage(Hex.fromString('Message 2'))

        const sig1 = await pk.sign(testWallet, testChainId, payload1)
        const sig2 = await pk.sign(testWallet, testChainId, payload2)

        const hashSig1 = sig1 as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        expect(hashSig1.r).not.toBe((sig2 as any).r)
      })
    })

    describe('Witness Method', () => {
      let pk: Pk
      let mockStateWriter: State.Writer

      beforeEach(() => {
        pk = new Pk(testPrivateKey)
        mockStateWriter = {
          saveWitnesses: vi.fn().mockResolvedValue(undefined),
        } as any
      })

      it('Should create witness with default message structure', async () => {
        await pk.witness(mockStateWriter, testWallet)

        expect(mockStateWriter.saveWitnesses).toHaveBeenCalledTimes(1)
        const [wallet, chainId, payload, witness] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]

        expect(wallet).toBe(testWallet)
        expect(chainId).toBe(0n)
        // Cast witness to RawLeaf since we know it's an unrecovered-signer leaf
        const rawLeaf = witness as { type: 'unrecovered-signer'; weight: bigint; signature: any }
        expect(rawLeaf.type).toBe('unrecovered-signer')
        expect(rawLeaf.weight).toBe(1n)
        expect(rawLeaf.signature).toHaveProperty('type', 'hash')
      })

      it('Should include extra data in witness payload', async () => {
        const extraData = { customField: 'test-value', version: '1.0' }
        await pk.witness(mockStateWriter, testWallet, extraData)

        expect(mockStateWriter.saveWitnesses).toHaveBeenCalledTimes(1)
        const [, , payload] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]

        // Decode the payload message from the Message type
        const messagePayload = payload as { type: 'message'; message: Hex.Hex }
        const payloadMessage = Hex.toString(messagePayload.message)
        const witnessData = JSON.parse(payloadMessage)

        expect(witnessData.action).toBe('consent-to-be-part-of-wallet')
        expect(witnessData.wallet).toBe(testWallet)
        expect(witnessData.signer).toBe(pk.address)
        expect(witnessData.customField).toBe('test-value')
        expect(witnessData.version).toBe('1.0')
        expect(typeof witnessData.timestamp).toBe('number')
      })

      it('Should create valid signature for witness', async () => {
        await pk.witness(mockStateWriter, testWallet)

        const [, , , witness] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]

        const rawLeaf = witness as { type: 'unrecovered-signer'; weight: bigint; signature: any }
        const hashSig = rawLeaf.signature as { type: 'hash'; r: bigint; s: bigint; yParity: number }
        expect(hashSig).toHaveProperty('r')
        expect(hashSig).toHaveProperty('s')
        expect(hashSig).toHaveProperty('yParity')
        expect(hashSig.type).toBe('hash')
      })

      it('Should use timestamp in witness message', async () => {
        const beforeTime = Date.now()
        await pk.witness(mockStateWriter, testWallet)
        const afterTime = Date.now()

        const [, , payload] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]
        const messagePayload = payload as { type: 'message'; message: Hex.Hex }
        const witnessData = JSON.parse(Hex.toString(messagePayload.message))

        expect(witnessData.timestamp).toBeGreaterThanOrEqual(beforeTime)
        expect(witnessData.timestamp).toBeLessThanOrEqual(afterTime)
      })
    })

    describe('Integration Tests', () => {
      it('Should work end-to-end with different PkStore implementations', async () => {
        const memoryStore = new MemoryPkStore(testPrivateKey)
        const pkWithStore = new Pk(memoryStore)
        const pkWithHex = new Pk(testPrivateKey)

        const testDigest = Bytes.fromString('integration test')

        const sig1 = await pkWithStore.signDigest(testDigest)
        const sig2 = await pkWithHex.signDigest(testDigest)

        expect(sig1).toEqual(sig2)
      })
    })
  })

  describe('Custom PkStore Implementation', () => {
    it('Should work with custom PkStore implementation', async () => {
      class CustomPkStore implements PkStore {
        private privateKey: Hex.Hex

        constructor(pk: Hex.Hex) {
          this.privateKey = pk
        }

        address(): Address.Address {
          return Address.fromPublicKey(this.publicKey())
        }

        publicKey(): PublicKey.PublicKey {
          return Secp256k1.getPublicKey({ privateKey: this.privateKey })
        }

        async signDigest(digest: Bytes.Bytes): Promise<{ r: bigint; s: bigint; yParity: number }> {
          return Secp256k1.sign({ payload: digest, privateKey: this.privateKey })
        }
      }

      const customStore = new CustomPkStore(testPrivateKey)
      const pk = new Pk(customStore)

      expect(pk.address).toBe(customStore.address())
      expect(pk.pubKey).toEqual(customStore.publicKey())

      const signature = await pk.signDigest(Bytes.fromString('custom store test'))
      expect(signature.type).toBe('hash')
    })
  })
})

import type { Payload as PayloadTypes, Signature as SignatureTypes } from '@0xsequence/wallet-primitives'
import { Payload } from '@0xsequence/wallet-primitives'
import { Bytes, Hex, PublicKey, Secp256k1 } from 'ox'
import { Signer as SignerInterface, Witnessable } from '../index.js'
import { State } from '../../index.js'

export interface PkStore {
  address(): Address.Checksummed
  publicKey(): PublicKey.PublicKey
  signDigest(digest: Bytes.Bytes): Promise<{ r: bigint; s: bigint; yParity: number }>
}

export class MemoryPkStore implements PkStore {
  constructor(private readonly privateKey: Hex.Hex) {}

  address(): Address.Checksummed {
    return Address.fromPublicKey(this.publicKey())
  }

  publicKey(): PublicKey.PublicKey {
    return Secp256k1.getPublicKey({ privateKey: this.privateKey })
  }

  signDigest(digest: Bytes.Bytes): Promise<{ r: bigint; s: bigint; yParity: number }> {
    return Promise.resolve(Secp256k1.sign({ payload: digest, privateKey: this.privateKey }))
  }
}

export class Pk implements SignerInterface, Witnessable {
  private readonly privateKey: PkStore

  public readonly address: Address.Checksummed
  public readonly pubKey: PublicKey.PublicKey

  constructor(privateKey: Hex.Hex | PkStore) {
    this.privateKey = typeof privateKey === 'string' ? new MemoryPkStore(privateKey) : privateKey
    this.pubKey = this.privateKey.publicKey()
    this.address = this.privateKey.address()
  }

  async sign(
    wallet: Address.Checksummed,
    chainId: bigint,
    payload: PayloadTypes.Parented,
  ): Promise<SignatureTypes.SignatureOfSignerLeaf> {
    const hash = Payload.hash(wallet, chainId, payload)
    return this.signDigest(hash)
  }

  async signDigest(digest: Bytes.Bytes): Promise<SignatureTypes.SignatureOfSignerLeaf> {
    const signature = await this.privateKey.signDigest(digest)
    return { ...signature, type: 'hash' }
  }

  async witness(stateWriter: State.Writer, wallet: Address.Checksummed, extra?: Object): Promise<void> {
    const payload = Payload.fromMessage(
      Hex.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          signer: this.address,
          timestamp: Date.now(),
          ...extra,
        }),
      ),
    )

    const signature = await this.sign(wallet, 0n, payload)
    await stateWriter.saveWitnesses(wallet, 0n, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}

export * as Encrypted from './encrypted.js'

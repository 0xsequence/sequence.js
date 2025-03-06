import type { Payload as PayloadTypes, Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { Payload } from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex, PublicKey, Secp256k1 } from 'ox'
import { Signer as SignerInterface } from '.'

export class Pk implements SignerInterface {
  public readonly address: Address.Address
  public readonly pubKey: PublicKey.PublicKey

  constructor(private readonly privateKey: Hex.Hex | Bytes.Bytes) {
    this.pubKey = Secp256k1.getPublicKey({ privateKey: this.privateKey })
    this.address = Address.fromPublicKey(this.pubKey)
  }

  async sign(
    wallet: Address.Address,
    chainId: bigint,
    payload: PayloadTypes.Parented,
  ): Promise<SignatureTypes.SignatureOfSignerLeaf> {
    const hash = Payload.hash(wallet, chainId, payload)
    return this.signDigest(hash)
  }

  async signDigest(digest: Bytes.Bytes): Promise<SignatureTypes.SignatureOfSignerLeaf> {
    const signature = Secp256k1.sign({ payload: digest, privateKey: this.privateKey })
    return { ...signature, type: 'hash' }
  }
}

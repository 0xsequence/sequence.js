import { Hex, Bytes, PublicKey, Address, Secp256k1 } from 'ox'
import { Signer } from '../wallet'
import { Payload, Signature } from '@0xsequence/sequence-primitives'
import type { Payload as PayloadTypes, Signature as SignatureTypes } from '@0xsequence/sequence-primitives'

export class Pk implements Signer {
  public readonly address: Address.Address
  public readonly pubKey: PublicKey.PublicKey

  constructor(private readonly privateKey: Hex.Hex | Bytes.Bytes) {
    this.pubKey = Secp256k1.getPublicKey({ privateKey })
    this.address = Address.fromPublicKey(this.pubKey)
  }

  async sign(
    wallet: Address.Address,
    chainId: bigint,
    payload: PayloadTypes.Parented,
  ): Promise<SignatureTypes.SignatureOfSignerLeaf> {
    const hash = Payload.hash(wallet, chainId, payload)
    const signature = Secp256k1.sign({ payload: hash, privateKey: this.privateKey })
    return { ...signature, type: 'hash' }
  }
}

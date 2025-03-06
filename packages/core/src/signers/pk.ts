import type { Payload as PayloadTypes, Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { Payload } from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex, PublicKey, Secp256k1 } from 'ox'
import { Signer as SignerInterface, Witnessable } from '.'
import { State } from '..'

export class Pk implements SignerInterface, Witnessable {
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

  async witness(stateWriter: State.Writer, wallet: Address.Address): Promise<void> {
    const payload = Payload.fromMessage(
      Bytes.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          signer: this.address,
          timestamp: Date.now(),
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

import { Address, Hex, Signature, AbiParameters, Bytes, TypedData } from 'ox'
import { Shared } from './manager.js'
import { Kinds } from './types/signer.js'
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'

export class Guard {
  constructor(private readonly shared: Shared) {}

  async sign(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Payload,
  ): Promise<SequenceSignature.SignatureOfSignerLeafHash> {
    const digest = Payload.hash(wallet, chainId, payload)
    const typedData = Payload.toTyped(wallet, chainId, payload)
    const serialized = Hex.fromString(TypedData.serialize(typedData))

    const auxData = AbiParameters.encode(AbiParameters.from(['address', 'uint256', 'bytes', 'bytes']), [
      Address.from(wallet),
      BigInt(chainId),
      serialized,
      '0x',
    ])

    try {
      const res = await fetch(`${this.shared.sequence.guardUrl}/rpc/Guard/SignWith`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signer: this.shared.sequence.guardAddress,
          request: {
            chainId: Number(chainId),
            msg: Hex.fromBytes(digest),
            auxData,
          },
        }),
      })

      const { sig } = await res.json()
      const signature = Signature.fromHex(sig)

      return {
        type: 'hash',
        ...signature,
      }
    } catch (error) {
      console.error('Error signing with guard:', error)
      throw new Error('Error signing with guard')
    }
  }

  async witness(wallet: Address.Address) {
    const payload = Payload.fromMessage(
      Hex.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          signer: this.shared.sequence.guardAddress,
          timestamp: Date.now(),
          extra: {
            signerKind: Kinds.Guard,
          },
        }),
      ),
    )

    const signature = await this.sign(wallet, 0, payload)

    await this.shared.sequence.stateProvider.saveWitnesses(wallet, 0, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}

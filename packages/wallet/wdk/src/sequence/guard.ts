import { Address, Hex, Signature, AbiParameters, Bytes, TypedData } from 'ox'
import { Shared } from './manager.js'
import { Kinds } from './types/signer.js'
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'

export class Guard {
  constructor(private readonly shared: Shared) {}

  async sign(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Payload,
  ): Promise<SequenceSignature.SignatureOfSignerLeafHash> {
    const digest = Payload.hash(wallet, chainId, payload)
    const typedData = Payload.toTyped(wallet, chainId, payload)
    const serialized = Hex.fromString(TypedData.serialize(typedData))

    const auxData = AbiParameters.encode(AbiParameters.from(['address', 'uint256', 'bytes', 'bytes']), [
      Address.from(wallet),
      chainId,
      serialized,
      '0x',
    ])

    const res = await fetch(`${this.shared.sequence.guardUrl}/rpc/Guard/SignWith`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signer: this.shared.sequence.extensions.guard,
        request: {
          chainId: 0,
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
  }

  async witness(wallet: Address.Address) {
    const payload = Payload.fromMessage(
      Hex.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          signer: this.shared.sequence.extensions.guard,
          timestamp: Date.now(),
          extra: {
            signerKind: Kinds.Guard,
          },
        }),
      ),
    )

    const signature = await this.sign(wallet, 0n, payload)

    await this.shared.sequence.stateProvider.saveWitnesses(wallet, 0n, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}

import { AbiParameters, Address, Bytes, Hex } from 'ox'
import { WrappedSignature } from 'ox/erc6492'

export function erc6492<T extends Bytes.Bytes | Hex.Hex>(
  signature: T,
  to: Address.Address,
  data: Bytes.Bytes | Hex.Hex,
): T {
  const encoded = Hex.concat(
    AbiParameters.encode(
      [{ type: 'address' }, { type: 'bytes' }, { type: 'bytes' }],
      [to, Hex.from(data), Hex.from(signature)],
    ),
    WrappedSignature.magicBytes,
  )

  switch (typeof signature) {
    case 'object':
      return Hex.toBytes(encoded) as T
    case 'string':
      return encoded as T
  }
}

export function erc6492Decode<T extends Bytes.Bytes | Hex.Hex>(
  signature: T,
): { signature: T; to?: Address.Address; data?: T } {
  switch (typeof signature) {
    case 'object':
      if (
        Bytes.toHex(signature.subarray(-WrappedSignature.magicBytes.slice(2).length / 2)) ===
        WrappedSignature.magicBytes
      ) {
        const [to, data, decoded] = AbiParameters.decode(
          [{ type: 'address' }, { type: 'bytes' }, { type: 'bytes' }],
          signature.subarray(0, -WrappedSignature.magicBytes.slice(2).length / 2),
        )
        return { signature: Hex.toBytes(decoded) as T, to, data: Hex.toBytes(data) as T }
      } else {
        return { signature }
      }

    case 'string':
      if (signature.endsWith(WrappedSignature.magicBytes.slice(2))) {
        try {
          const [to, data, decoded] = AbiParameters.decode(
            [{ type: 'address' }, { type: 'bytes' }, { type: 'bytes' }],
            signature.slice(0, -WrappedSignature.magicBytes.slice(2).length) as Hex.Hex,
          )
          return { signature: decoded as T, to, data: data as T }
        } catch {
          return { signature }
        }
      } else {
        return { signature }
      }
  }
}

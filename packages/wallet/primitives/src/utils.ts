import { AbiParameters, Bytes, Hash, Hex } from 'ox'

export function minBytesFor(val: bigint): number {
  return Math.ceil(val.toString(16).length / 2)
}

// ERC-2098
export function packRSY({ r, s, yParity }: { r: bigint; s: bigint; yParity: number }): Bytes.Bytes {
  const rBytes = Bytes.padLeft(Bytes.fromNumber(r), 32)
  let sBytes = Bytes.padLeft(Bytes.fromNumber(s), 32)
  if (yParity % 2 === 1) {
    sBytes[0]! |= 0x80
  }

  return Bytes.concat(rBytes, sBytes)
}

export function unpackRSY(rsy: Bytes.Bytes): { r: bigint; s: bigint; yParity: number } {
  const r = Bytes.toBigInt(rsy.slice(0, 32))
  const yParityAndS = rsy.slice(32, 64)
  const yParity = (yParityAndS[0]! & 0x80) !== 0 ? 1 : 0
  const sBytes = new Uint8Array(yParityAndS)
  sBytes[0] = sBytes[0]! & 0x7f
  const s = Bytes.toBigInt(sBytes)
  return { r, s, yParity }
}

export function getStorageSlotForMappingWithKey(mappingSlot: bigint, key: Hex.Hex): Hex.Hex {
  const paddedKey = Hex.padLeft(key, 32)
  return Hash.keccak256(AbiParameters.encode([{ type: 'bytes32' }, { type: 'uint256' }], [paddedKey, mappingSlot]))
}

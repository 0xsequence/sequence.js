import { Bytes } from 'ox'

export function minBytesFor(val: bigint): number {
  return Math.ceil(val.toString(16).length / 2)
}

// ERC-2098
export function packRSV({ r, s, v }: { r: Bytes.Bytes; s: Bytes.Bytes; v: number }): Bytes.Bytes {
  r = Bytes.padLeft(r, 32)
  s = Bytes.padLeft(s, 32)
  if (v % 2 === 0) {
    s[0]! |= 0x80
  }

  return Bytes.concat(r, s)
}

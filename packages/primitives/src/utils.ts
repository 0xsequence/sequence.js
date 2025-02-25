import { Bytes, Signature } from 'ox'

export function minBytesFor(val: bigint): number {
  return Math.ceil(val.toString(16).length / 2)
}

// ERC-2098
export function packRSV(signature: Signature.Signature<true>): Bytes.Bytes {
  const { r, s, yParity } = signature
  const rBytes = Bytes.fromNumber(r, { size: 32 })
  const sBytes = Bytes.fromNumber(s, { size: 32 })
  if (yParity % 2 === 1) {
    sBytes[0]! |= 0x80
  }

  return Bytes.concat(rBytes, sBytes)
}

export function unpackRSV(packed: Bytes.Bytes): Signature.Signature<true> {
  if (packed.length !== 64) {
    throw new Error('Invalid packed signature length')
  }
  const r = Bytes.toBigInt(packed.slice(0, 32))
  const yParityAndS = packed.slice(32, 64)
  const yParity = (yParityAndS[0]! & 0x80) !== 0 ? 1 : 0
  const sArray = new Uint8Array(32)
  sArray.set(yParityAndS)
  sArray[0] = sArray[0]! & 0x7f
  const s = Bytes.toBigInt(sArray)
  return { r, s, yParity }
}

// RSV string encoding

export function rsvToStr(rsv: Signature.Signature<true>): string {
  return `${rsv.r.toString()}:${rsv.s.toString()}:${Signature.yParityToV(rsv.yParity)}`
}

export function rsvFromStr(sigStr: string): Signature.Signature<true> {
  const parts = sigStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Signature must be in r:s:v format')
  }
  const [rStr, sStr, vStr] = parts
  if (!rStr || !sStr || !vStr) {
    throw new Error('Invalid signature format')
  }

  return {
    r: Bytes.toBigInt(Bytes.fromHex(rStr as `0x${string}`, { size: 32 })),
    s: Bytes.toBigInt(Bytes.fromHex(sStr as `0x${string}`, { size: 32 })),
    yParity: Signature.vToYParity(parseInt(vStr, 10)),
  }
}

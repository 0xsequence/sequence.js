export function minBytesFor(val: bigint): number {
  return Math.ceil(val.toString(16).length / 2)
}

import { Arguments } from 'yargs'
import { Bytes } from 'ox'

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    process.stdin.on('error', (err) => {
      reject(err)
    })
  })
}
export async function fromPosOrStdin<T>(argv: Arguments<T>, arg: keyof T): Promise<string> {
  const argValue = String(argv[arg])
  const hasArg = typeof argv[arg] === 'string' && argValue.length > 0

  if (hasArg) {
    return argValue
  }

  const hasStdin = !process.stdin.isTTY
  if (!hasStdin) {
    throw new Error(`No ${String(arg)} provided and no stdin data`)
  }

  return await readStdin()
}

/**
 * Helper to parse a signature from a string in "r:s:v" format.
 * Returns an object with { v, r, s } where r and s are Uint8Array.
 */
export function parseRSV(sigStr: string): { v: number; r: Bytes.Bytes; s: Bytes.Bytes } {
  const parts = sigStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Signature must be in r:s:v format')
  }
  const [rStr, sStr, vStr] = parts
  if (!rStr || !sStr || !vStr) {
    throw new Error('Invalid signature format')
  }
  return {
    v: parseInt(vStr, 10),
    r: Bytes.fromHex(rStr as `0x${string}`),
    s: Bytes.fromHex(sStr as `0x${string}`),
  }
}

export function requireString(arg: string | undefined, name: string): asserts arg is string {
  if (!arg) {
    throw new Error(`${name} is required`)
  }
}

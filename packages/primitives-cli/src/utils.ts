import { Arguments } from 'yargs'

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

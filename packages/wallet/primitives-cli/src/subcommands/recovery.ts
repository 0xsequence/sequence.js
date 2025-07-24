import { CommandModule } from 'yargs'
import { readStdin } from '../utils.js'
import { Bytes, Hex } from 'ox'
import { Extensions } from '@0xsequence/wallet-primitives'

async function parseLeaves(leavesInput: string | string[]): Promise<Extensions.Recovery.RecoveryLeaf[]> {
  if (typeof leavesInput === 'string') {
    return parseLeaves(leavesInput.split(' '))
  }

  return leavesInput.map((leafStr) => {
    const parts = leafStr.split(':')
    if (parts.length !== 4 || parts[0] !== 'signer') {
      throw new Error(`Invalid leaf format: ${leafStr}`)
    }
    const [_, address, requiredDeltaTimeStr, minTimestampStr] = parts
    if (address === undefined) {
      throw new Error('no address for recovery leaf')
    }
    Address.assert(address)
    if (!requiredDeltaTimeStr || !minTimestampStr) {
      throw new Error(`Invalid leaf format: ${leafStr}`)
    }
    const requiredDeltaTime = BigInt(requiredDeltaTimeStr)
    const minTimestamp = BigInt(minTimestampStr)
    return {
      type: 'leaf',
      signer: address,
      requiredDeltaTime,
      minTimestamp,
    }
  })
}

export async function doHashFromLeaves(leavesInput: string | string[]): Promise<string> {
  const leaves = await parseLeaves(leavesInput)
  const topology = Extensions.Recovery.fromRecoveryLeaves(leaves)
  return Extensions.Recovery.hashConfiguration(topology)
}

export async function doEncode(leavesInput: string | string[]): Promise<string> {
  const leaves = await parseLeaves(leavesInput)
  const topology = Extensions.Recovery.fromRecoveryLeaves(leaves)
  const encoded = Extensions.Recovery.encodeTopology(topology)
  return Bytes.toHex(encoded)
}

export async function doTrim(leavesInput: string | string[], signer: Address.Address): Promise<string> {
  const leaves = await parseLeaves(leavesInput)
  const topology = Extensions.Recovery.fromRecoveryLeaves(leaves)
  const trimmed = Extensions.Recovery.trimTopology(topology, signer)
  const encoded = Extensions.Recovery.encodeTopology(trimmed)
  return Bytes.toHex(encoded)
}

export async function doHashEncoded(encodedStr: Hex.Hex): Promise<string> {
  const encoded = Bytes.fromHex(encodedStr)
  const topology = Extensions.Recovery.decodeTopology(encoded)
  return Extensions.Recovery.hashConfiguration(topology)
}

const recoveryCommand: CommandModule = {
  command: 'recovery',
  describe: 'Recovery tree utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'hash-from-leaves [leaves...]',
        'Compute the hash of a recovery topology from leaves',
        (yargs) => {
          return yargs
            .positional('leaves', {
              type: 'string',
              array: true,
              description: 'List of recovery leaves in "signer:address:requiredDeltaTime:minTimestamp" format',
              demandOption: false,
            })
            .example('$0 recovery hash-from-leaves signer:0x123...:100:1600000000', 'hash a single leaf')
        },
        async (argv) => {
          let leavesInput: string[]
          if (argv.leaves) {
            leavesInput = argv.leaves
          } else {
            const stdin = await readStdin()
            leavesInput = stdin
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line)
          }
          try {
            const hash = await doHashFromLeaves(leavesInput)
            console.log(hash)
          } catch (error) {
            console.error((error as Error).message)
            process.exit(1)
          }
        },
      )
      .command(
        'encode [leaves...]',
        'Encode recovery leaves into topology bytes',
        (yargs) => {
          return yargs.positional('leaves', {
            type: 'string',
            array: true,
            description: 'List of recovery leaves in "signer:address:requiredDeltaTime:minTimestamp" format',
            demandOption: false,
          })
        },
        async (argv) => {
          let leavesInput: string[]
          if (argv.leaves) {
            leavesInput = argv.leaves
          } else {
            const stdin = await readStdin()
            leavesInput = stdin
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line)
          }
          try {
            const encoded = await doEncode(leavesInput)
            console.log(encoded)
          } catch (error) {
            console.error((error as Error).message)
            process.exit(1)
          }
        },
      )
      .command(
        'trim [leaves...]',
        'Trim the topology to a specific signer and encode',
        (yargs) => {
          return yargs
            .positional('leaves', {
              type: 'string',
              array: true,
              description: 'List of recovery leaves in "signer:address:requiredDeltaTime:minTimestamp" format',
              demandOption: false,
            })
            .option('signer', {
              type: 'string',
              description: 'Signer address to keep',
              demandOption: true,
            })
        },
        async (argv) => {
          let leavesInput: string[]
          if (argv.leaves) {
            leavesInput = argv.leaves
          } else {
            const stdin = await readStdin()
            leavesInput = stdin
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line)
          }
          const signer = argv.signer
          Address.assert(signer)
          try {
            const encoded = await doTrim(leavesInput, signer)
            console.log(encoded)
          } catch (error) {
            console.error((error as Error).message)
            process.exit(1)
          }
        },
      )
      .command(
        'hash-encoded [encoded]',
        'Compute the hash of an encoded recovery topology',
        (yargs) => {
          return yargs.positional('encoded', {
            type: 'string',
            description: 'The encoded topology in hex format',
            demandOption: true,
          })
        },
        async (argv) => {
          const encodedStr = argv.encoded
          try {
            const hash = await doHashEncoded(Hex.fromString(encodedStr))
            console.log(hash)
          } catch (error) {
            console.error((error as Error).message)
            process.exit(1)
          }
        },
      )
      .demandCommand(1, 'You must specify a subcommand for recovery')
  },
  handler: () => {},
}

export default recoveryCommand

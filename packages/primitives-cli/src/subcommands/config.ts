import crypto from 'crypto'
import type { CommandModule } from 'yargs'
import {
  Configuration,
  Topology,
  configToJson,
  configFromJson,
  encodeSignature,
  hashConfiguration,
} from '@0xsequence/sequence-primitives'
import { Bytes, Hex } from 'ox'

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function randomBigInt(max: bigint): bigint {
  return BigInt(Math.floor(Math.random() * Number(max)))
}

function randomAddress(): `0x${string}` {
  return `0x${Buffer.from(randomBytes(20)).toString('hex')}`
}

function generateRandomTopology(depth: number): Topology {
  if (depth <= 0) {
    // Generate a random leaf
    const leafType = Math.floor(Math.random() * 5)

    switch (leafType) {
      case 0: // SignerLeaf
        return {
          type: 'signer',
          address: randomAddress(),
          weight: randomBigInt(100n),
        }

      case 1: // SapientSigner
        return {
          type: 'sapient-signer',
          address: randomAddress(),
          weight: randomBigInt(100n),
          imageHash: randomBytes(32),
        }

      case 2: // SubdigestLeaf
        return {
          type: 'subdigest',
          digest: randomBytes(32),
        }

      case 3: // NodeLeaf
        return randomBytes(32)

      case 4: // NestedLeaf
        return {
          type: 'nested',
          tree: generateRandomTopology(0),
          weight: randomBigInt(100n),
          threshold: randomBigInt(50n),
        }
    }
  }

  // Generate a node with two random subtrees
  return [generateRandomTopology(depth - 1), generateRandomTopology(depth - 1)]
}

async function generateRandom(maxDepth: number): Promise<void> {
  const config: Configuration = {
    threshold: randomBigInt(100n),
    checkpoint: randomBigInt(1000n),
    topology: generateRandomTopology(maxDepth),
    checkpointer: Math.random() > 0.5 ? randomAddress() : undefined,
  }

  const encoded = encodeSignature(config)
  console.log(Hex.fromBytes(encoded))
}

async function createConfig(options: { threshold: number; checkpoint: number }): Promise<void> {
  const config: Configuration = {
    threshold: BigInt(options.threshold),
    checkpoint: BigInt(options.checkpoint),
    // Starts with empty topology
    topology: Bytes.padLeft(Bytes.fromNumber(1), 32),
    checkpointer: undefined,
  }

  console.log(configToJson(config))
}

async function getInput(input?: string): Promise<string> {
  if (input) {
    return input
  }
  let stdin = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    stdin += chunk
  }
  return stdin
}

async function calculateImageHash(input: string): Promise<void> {
  const config = configFromJson(input)
  console.log(Hex.fromBytes(hashConfiguration(config)))
}

async function doEncode(input: string): Promise<void> {
  const config = configFromJson(input)
  console.log(Hex.fromBytes(encodeSignature(config as Configuration)))
}

const configCommand: CommandModule = {
  command: 'config',
  describe: 'Configuration utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'random',
        'Generate a random configuration',
        (yargs) => {
          return yargs.option('max-depth', {
            type: 'number',
            description: 'Maximum depth of the configuration tree',
            default: 3,
          })
        },
        async (argv) => {
          await generateRandom(argv.maxDepth as number)
        },
      )
      .command(
        'new',
        'Create a new configuration',
        (yargs) => {
          return yargs
            .option('threshold', {
              type: 'number',
              description: 'Threshold value for the configuration',
              demandOption: true,
            })
            .option('checkpoint', {
              type: 'number',
              description: 'Checkpoint value for the configuration',
              demandOption: true,
            })
        },
        async (argv) => {
          await createConfig(argv)
        },
      )
      .command(
        'image-hash',
        'Calculate image hash from hex input',
        (yargs) => {
          return yargs.option('input', {
            type: 'string',
            description: 'Hex input to hash (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await getInput(argv.input as string)
          await calculateImageHash(input)
        },
      )
      .command(
        'encode',
        'Encode configuration from hex input',
        (yargs) => {
          return yargs.option('input', {
            type: 'string',
            description: 'Hex input to encode (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await getInput(argv.input as string)
          await doEncode(input)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for config')
  },
  handler: () => {},
}

export default configCommand

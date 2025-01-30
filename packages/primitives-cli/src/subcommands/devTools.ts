import crypto from 'crypto'
import type { CommandModule } from 'yargs'
import { Configuration, Topology, configToJson } from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'

interface RandomOptions {
  seededRandom?: () => number
  minThresholdOnNested?: number
}

function createSeededRandom(seed: string) {
  let currentSeed = seed
  let hash = crypto.createHash('sha256').update(currentSeed).digest()
  let index = 0

  return () => {
    if (index >= hash.length - 4) {
      currentSeed = currentSeed + '1'
      hash = crypto.createHash('sha256').update(currentSeed).digest()
      index = 0
    }

    const value = hash.readUInt32LE(index) / 0x100000000
    index += 4
    return value
  }
}

function randomBytes(length: number, options?: RandomOptions): Uint8Array {
  const bytes = new Uint8Array(length)
  if (options?.seededRandom) {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(options.seededRandom() * 256)
    }
    return bytes
  }
  return crypto.getRandomValues(bytes)
}

function randomBigInt(max: bigint, options?: RandomOptions): bigint {
  if (options?.seededRandom) {
    return BigInt(Math.floor(options.seededRandom() * Number(max)))
  }
  return BigInt(Math.floor(Math.random() * Number(max)))
}

function randomAddress(options?: RandomOptions): `0x${string}` {
  return `0x${Buffer.from(randomBytes(20, options)).toString('hex')}`
}

function generateRandomTopology(depth: number, options?: RandomOptions): Topology {
  if (depth <= 0) {
    const leafType = options?.seededRandom ? Math.floor(options.seededRandom() * 5) : Math.floor(Math.random() * 5)

    switch (leafType) {
      case 0: // SignerLeaf
        return {
          type: 'signer',
          address: randomAddress(options),
          weight: randomBigInt(256n, options),
        }

      case 1: // SapientSigner
        return {
          type: 'sapient-signer',
          address: randomAddress(options),
          weight: randomBigInt(256n, options),
          imageHash: randomBytes(32, options),
        }

      case 2: // SubdigestLeaf
        return {
          type: 'subdigest',
          digest: randomBytes(32, options),
        }

      case 3: // NodeLeaf
        return randomBytes(32, options)

      case 4: // NestedLeaf
        const minThreshold = BigInt(options?.minThresholdOnNested ?? 0)
        return {
          type: 'nested',
          tree: generateRandomTopology(0, options),
          weight: randomBigInt(256n, options),
          threshold: minThreshold + randomBigInt(65535n - minThreshold, options),
        }
    }
  }

  // Generate a node with two random subtrees
  return [generateRandomTopology(depth - 1, options), generateRandomTopology(depth - 1, options)]
}

async function generateRandomConfig(maxDepth: number, options?: RandomOptions): Promise<void> {
  const config: Configuration = {
    threshold: randomBigInt(100n, options),
    checkpoint: randomBigInt(1000n, options),
    topology: generateRandomTopology(maxDepth, options),
    checkpointer:
      (options?.seededRandom ? options.seededRandom() : Math.random()) > 0.5 ? randomAddress(options) : undefined,
  }

  console.log(configToJson(config))
}

const command: CommandModule = {
  command: 'dev-tools',
  describe: 'Development tools and utilities',
  builder: (yargs) =>
    yargs
      .command(
        'random-config',
        'Generate a random configuration',
        (yargs) => {
          return yargs
            .option('max-depth', {
              type: 'number',
              description: 'Maximum depth of the configuration tree',
              default: 3,
            })
            .option('seed', {
              type: 'string',
              description: 'Seed for deterministic generation',
              required: false,
            })
            .option('min-threshold-on-nested', {
              type: 'number',
              description: 'Minimum threshold value for nested leaves',
              default: 0,
            })
        },
        async (argv) => {
          const options: RandomOptions = {
            seededRandom: argv.seed ? createSeededRandom(argv.seed) : undefined,
            minThresholdOnNested: argv.minThresholdOnNested as number,
          }
          await generateRandomConfig(argv.maxDepth as number, options)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for dev-tools')
      .strict(),
  handler: () => {},
}

export default command

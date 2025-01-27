import crypto from 'crypto'
import type { CommandModule } from 'yargs'
import {
  Configuration,
  Topology,
  configToJson,
} from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'

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

function randomBytes(length: number, seededRandom?: () => number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (seededRandom) {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(seededRandom() * 256)
    }
    return bytes
  }
  return crypto.getRandomValues(bytes)
}

function randomBigInt(max: bigint, seededRandom?: () => number): bigint {
  if (seededRandom) {
    return BigInt(Math.floor(seededRandom() * Number(max)))
  }
  return BigInt(Math.floor(Math.random() * Number(max)))
}

function randomAddress(seededRandom?: () => number): `0x${string}` {
  return `0x${Buffer.from(randomBytes(20, seededRandom)).toString('hex')}`
}

function generateRandomTopology(depth: number, seededRandom?: () => number): Topology {
  if (depth <= 0) {
    const leafType = seededRandom 
      ? Math.floor(seededRandom() * 5)
      : Math.floor(Math.random() * 5)

    switch (leafType) {
      case 0: // SignerLeaf
        return {
          type: 'signer',
          address: randomAddress(seededRandom),
          weight: randomBigInt(100n, seededRandom),
        }

      case 1: // SapientSigner
        return {
          type: 'sapient-signer',
          address: randomAddress(seededRandom),
          weight: randomBigInt(100n, seededRandom),
          imageHash: randomBytes(32, seededRandom),
        }

      case 2: // SubdigestLeaf
        return {
          type: 'subdigest',
          digest: randomBytes(32, seededRandom),
        }

      case 3: // NodeLeaf
        return randomBytes(32, seededRandom)

      case 4: // NestedLeaf
        return {
          type: 'nested',
          tree: generateRandomTopology(0, seededRandom),
          weight: randomBigInt(100n, seededRandom),
          threshold: randomBigInt(50n, seededRandom),
        }
    }
  }

  // Generate a node with two random subtrees
  return [
    generateRandomTopology(depth - 1, seededRandom),
    generateRandomTopology(depth - 1, seededRandom)
  ]
}

async function generateRandomConfig(maxDepth: number, seed?: string): Promise<void> {
  const seededRandom = seed ? createSeededRandom(seed) : undefined
  
  const config: Configuration = {
    threshold: randomBigInt(100n, seededRandom),
    checkpoint: randomBigInt(1000n, seededRandom),
    topology: generateRandomTopology(maxDepth, seededRandom),
    checkpointer: (seededRandom ? seededRandom() : Math.random()) > 0.5 
      ? randomAddress(seededRandom) 
      : undefined,
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
        },
        async (argv) => {
          await generateRandomConfig(argv.maxDepth as number, argv.seed)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for dev-tools')
      .strict(),
  handler: () => {},
}

export default command 

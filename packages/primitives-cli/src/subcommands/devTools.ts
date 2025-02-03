import {
  Configuration,
  ParameterRule,
  Permission,
  SessionsTopology,
  Topology,
  configToJson,
  sessionsTopologyToJson,
} from '@0xsequence/sequence-primitives'
import crypto from 'crypto'
import type { CommandModule } from 'yargs'

interface RandomOptions {
  seededRandom?: () => number
  minThresholdOnNested?: number
  maxPermissions?: number
  maxRules?: number
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
    const leafType = Math.floor((options?.seededRandom ?? Math.random)() * 5)

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

async function generateSessionsTopology(depth: number, options?: RandomOptions): Promise<SessionsTopology> {
  const isLeaf = (options?.seededRandom ?? Math.random)() * 2 > 1

  if (isLeaf || depth <= 1) {
    const permissionsCount = Math.floor((options?.seededRandom ?? Math.random)() * (options?.maxPermissions ?? 5)) + 1
    return {
      signer: randomAddress(options),
      valueLimit: randomBigInt(100n, options),
      deadline: randomBigInt(1000n, options),
      permissions: await Promise.all(Array.from({ length: permissionsCount }, () => generateRandomPermission(options))),
    }
  }

  return [await generateSessionsTopology(depth - 1, options), await generateSessionsTopology(depth - 1, options)]
}

async function generateRandomPermission(options?: RandomOptions): Promise<Permission> {
  const rulesCount = Math.floor((options?.seededRandom ?? Math.random)() * (options?.maxRules ?? 5)) + 1
  return {
    target: randomAddress(options),
    rules: await Promise.all(Array.from({ length: rulesCount }, () => generateRandomRule(options))),
  }
}

async function generateRandomRule(options?: RandomOptions): Promise<ParameterRule> {
  return {
    cumulative: (options?.seededRandom ?? Math.random)() * 2 > 1,
    operation: Math.floor((options?.seededRandom ?? Math.random)() * 4),
    value: randomBytes(32, options),
    offset: randomBigInt(100n, options),
    mask: randomBytes(32, options),
  }
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
      .command(
        'random-session-topology',
        'Generate a random session topology',
        (yargs) => {
          return yargs
            .option('max-depth', {
              type: 'number',
              description: 'Maximum depth of the session topology',
              default: 1,
            })
            .option('max-permissions', {
              type: 'number',
              description: 'Maximum number of permissions in each session',
              default: 1,
            })
            .option('max-rules', {
              type: 'number',
              description: 'Maximum number of rules in each permission',
              default: 1,
            })
            .option('seed', {
              type: 'string',
              description: 'Seed for deterministic generation',
              required: false,
            })
        },
        async (argv) => {
          const options: RandomOptions = {
            seededRandom: argv.seed ? createSeededRandom(argv.seed) : undefined,
            maxPermissions: argv.maxPermissions as number,
            maxRules: argv.maxRules as number,
          }
          const topology = await generateSessionsTopology(argv.maxDepth as number, options)
          console.log(sessionsTopologyToJson(topology))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for dev-tools')
      .strict(),
  handler: () => {},
}

export default command

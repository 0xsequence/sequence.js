import { Address, Permission, SessionConfig, Config } from '@0xsequence/wallet-primitives'
import crypto from 'crypto'
import { Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'

export interface RandomOptions {
  seededRandom?: () => number
  minThresholdOnNested?: number
  maxPermissions?: number
  maxRules?: number
  checkpointerMode?: 'no' | 'random' | 'yes'
  skewed?: 'left' | 'right' | 'none'
}

export function createSeededRandom(seed: string) {
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

function randomHex(length: number, options?: RandomOptions): Hex.Hex {
  return Bytes.toHex(randomBytes(length, options))
}

function randomBigInt(max: bigint, options?: RandomOptions): bigint {
  if (options?.seededRandom) {
    return BigInt(Math.floor(options.seededRandom() * Number(max)))
  }
  return BigInt(Math.floor(Math.random() * Number(max)))
}

function randomAddress(options?: RandomOptions): Address.Checksummed {
  return Address.checksum(`0x${Buffer.from(randomBytes(20, options)).toString('hex')}`)
}

function generateRandomTopology(depth: number, options?: RandomOptions): Config.Topology {
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
          imageHash: randomHex(32, options),
        }

      case 2: // SubdigestLeaf
        return {
          type: 'subdigest',
          digest: randomHex(32, options),
        }

      case 3: // NodeLeaf
        return randomHex(32, options)

      case 4: {
        // NestedLeaf
        const minThreshold = BigInt(options?.minThresholdOnNested ?? 0)
        return {
          type: 'nested',
          tree: generateRandomTopology(0, options),
          weight: randomBigInt(256n, options),
          threshold: minThreshold + randomBigInt(65535n - minThreshold, options),
        }
      }
    }
  }

  // Generate a node with two random subtrees
  if (options?.skewed === 'left') {
    return [generateRandomTopology(0, options), generateRandomTopology(depth - 1, options)]
  } else if (options?.skewed === 'right') {
    return [generateRandomTopology(depth - 1, options), generateRandomTopology(0, options)]
  } else {
    return [generateRandomTopology(depth - 1, options), generateRandomTopology(depth - 1, options)]
  }
}

async function generateSessionsTopology(
  depth: number,
  options?: RandomOptions,
): Promise<SessionConfig.SessionsTopology> {
  const isLeaf = (options?.seededRandom ?? Math.random)() * 2 > 1

  if (isLeaf || depth <= 1) {
    const permissionsCount = Math.floor((options?.seededRandom ?? Math.random)() * (options?.maxPermissions ?? 5)) + 1
    const permissions = await Promise.all(
      Array.from({ length: permissionsCount }, () => generateRandomPermission(options)),
    )
    return {
      type: 'session-permissions',
      signer: randomAddress(options),
      chainId: randomBigInt(1000000000000000000n, options),
      valueLimit: randomBigInt(100n, options),
      deadline: randomBigInt(1000n, options),
      permissions: permissions as [Permission.Permission, ...Permission.Permission[]],
    }
  }

  return [await generateSessionsTopology(depth - 1, options), await generateSessionsTopology(depth - 1, options)]
}

async function generateRandomPermission(options?: RandomOptions): Promise<Permission.Permission> {
  const rulesCount = Math.floor((options?.seededRandom ?? Math.random)() * (options?.maxRules ?? 5)) + 1
  return {
    target: randomAddress(options),
    rules: await Promise.all(Array.from({ length: rulesCount }, () => generateRandomRule(options))),
  }
}

async function generateRandomRule(options?: RandomOptions): Promise<Permission.ParameterRule> {
  return {
    cumulative: (options?.seededRandom ?? Math.random)() * 2 > 1,
    operation: Math.floor((options?.seededRandom ?? Math.random)() * 4),
    value: randomBytes(32, options),
    offset: randomBigInt(100n, options),
    mask: randomBytes(32, options),
  }
}

export async function doRandomConfig(maxDepth: number, options?: RandomOptions): Promise<string> {
  const config: Config.Config = {
    threshold: randomBigInt(100n, options),
    checkpoint: randomBigInt(1000n, options),
    topology: generateRandomTopology(maxDepth, options),
    checkpointer: (() => {
      switch (options?.checkpointerMode) {
        case 'yes':
          return randomAddress(options)
        case 'random':
          return (options?.seededRandom?.() ?? Math.random()) > 0.5 ? randomAddress(options) : undefined
        case 'no':
        default:
          return undefined
      }
    })(),
  }
  return Config.configToJson(config)
}

export async function doRandomSessionTopology(maxDepth: number, options?: RandomOptions): Promise<string> {
  const topology = await generateSessionsTopology(maxDepth, options)
  return SessionConfig.sessionsTopologyToJson(topology)
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
            .option('checkpointer', {
              type: 'string',
              choices: ['no', 'random', 'yes'],
              description: 'Checkpointer mode: no (never add), random (50% chance), yes (always add)',
              default: 'no',
            })
            .option('skewed', {
              type: 'string',
              choices: ['left', 'right', 'none'],
              description: 'Skewed topology: left (left-heavy), right (right-heavy), none (balanced)',
              default: 'none',
            })
        },
        async (argv) => {
          const options: RandomOptions = {
            seededRandom: argv.seed ? createSeededRandom(argv.seed) : undefined,
            minThresholdOnNested: argv.minThresholdOnNested,
            checkpointerMode: argv.checkpointer as 'no' | 'random' | 'yes',
            skewed: argv.skewed as 'left' | 'right' | undefined,
          }
          const result = await doRandomConfig(argv.maxDepth as number, options)
          console.log(result)
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
            maxPermissions: argv.maxPermissions,
            maxRules: argv.maxRules,
            skewed: argv.skewed as 'left' | 'right' | undefined,
          }
          const result = await doRandomSessionTopology(argv.maxDepth as number, options)
          console.log(result)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for dev-tools')
      .strict(),
  handler: () => {},
}

export default command

import type { CommandModule } from 'yargs'
import {
  Configuration,
  configToJson,
  configFromJson,
  encodeSignature,
  hashConfiguration,
} from '@0xsequence/sequence-primitives'
import { Bytes, Hex } from 'ox'
import { fromPosOrStdin } from '../utils'

async function createConfig(options: { threshold: string; checkpoint: string }): Promise<void> {
  const config: Configuration = {
    threshold: BigInt(options.threshold),
    checkpoint: BigInt(options.checkpoint),
    // Starts with empty topology
    topology: Bytes.padLeft(Bytes.fromNumber(1), 32),
    checkpointer: undefined,
  }

  console.log(configToJson(config))
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
        'new',
        'Create a new configuration',
        (yargs) => {
          return yargs
            .option('threshold', {
              type: 'string',
              description: 'Threshold value for the configuration',
              demandOption: true,
            })
            .option('checkpoint', {
              type: 'string',
              description: 'Checkpoint value for the configuration',
              demandOption: true,
            })
        },
        async (argv) => {
          await createConfig(argv)
        },
      )
      .command(
        'image-hash [input]',
        'Calculate image hash from hex input',
        (yargs) => {
          return yargs.positional('input', {
            type: 'string',
            description: 'Hex input to hash (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          await calculateImageHash(input)
        },
      )
      .command(
        'encode [input]',
        'Encode configuration from hex input',
        (yargs) => {
          return yargs.positional('input', {
            type: 'string',
            description: 'Hex input to encode (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          await doEncode(input)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for config')
  },
  handler: () => {},
}

export default configCommand

import type { CommandModule } from 'yargs'

async function convertToAbi(_payload: string): Promise<void> {
  throw new Error('Not implemented')
}

async function convertToPacked(_payload: string): Promise<void> {
  throw new Error('Not implemented')
}

const payloadCommand: CommandModule = {
  command: 'payload',
  describe: 'Payload conversion utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'to-abi <payload>',
        'Convert payload to ABI format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
            demandOption: true,
          })
        },
        async (argv) => {
          await convertToAbi(argv.payload)
        },
      )
      .command(
        'to-packed <payload>',
        'Convert payload to packed format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
            demandOption: true,
          })
        },
        async (argv) => {
          await convertToPacked(argv.payload)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for payload')
  },
  handler: () => {},
}

export default payloadCommand

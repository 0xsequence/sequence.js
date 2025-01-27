import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncode(input: string): Promise<void> {
  // TODO: Implement signature encoding
  throw new Error('Not implemented')
}

const signatureCommand: CommandModule = {
  command: 'signature',
  describe: 'Signature utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'encode [input]',
        'Encode signature from hex input',
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
      .demandCommand(1, 'You must specify a subcommand for signature')
  },
  handler: () => {},
}

export default signatureCommand 
import { encodeSessionsTopology, sessionsTopologyFromJson } from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncodeSessionsTopology(input: string): Promise<void> {
  const topology = sessionsTopologyFromJson(input)
  const packed = encodeSessionsTopology(topology)
  console.log(Hex.from(packed))
}

const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Session conversion utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'to-packed-topology [session-topology]',
        'Convert session topology to packed format',
        (yargs) => {
          return yargs.positional('session-topology', {
            type: 'string',
            description: 'Input session topology to convert',
          })
        },
        async (argv) => {
          const permission = await fromPosOrStdin(argv, 'session-topology')
          await doEncodeSessionsTopology(permission)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

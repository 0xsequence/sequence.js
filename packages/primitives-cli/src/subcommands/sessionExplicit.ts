import { encodeSessionsTopology, sessionsTopologyFromJson } from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncodeSessionsTopology(input: string): Promise<void> {
  const topology = sessionsTopologyFromJson(input)
  const packed = encodeSessionsTopology(topology)
  console.log(Hex.from(packed))
}

const sessionExplicitCommand: CommandModule = {
  command: 'explicit',
  describe: 'Explicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'empty',
        'Create an empty session topology',
        () => {},
        async () => {
          console.log([])
        },
      )
      .command(
        'add [explicit-session] [session-topology]',
        'Add a session to the session topology',
        (yargs) => {
          return yargs
            .positional('explicit-session', {
              type: 'string',
              description: 'Explicit session to add',
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to add to',
            })
        },
        async (argv) => {
          const explicitSession = await fromPosOrStdin(argv, 'explicit-session')
          const sessionTopology = await fromPosOrStdin(argv, 'session-topology')
        },
      )
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

export default sessionExplicitCommand

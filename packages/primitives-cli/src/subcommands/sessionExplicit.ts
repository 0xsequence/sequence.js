import {
  encodeSessionsTopology,
  isEmptySessionsTopology,
  isSessionsTopology,
  mergeSessionsTopologies,
  removeSessionPermission,
  sessionsTopologyFromJson,
  sessionsTopologyToJson,
} from '@0xsequence/sequence-primitives'
import { Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncodeSessionsTopology(input: string): Promise<void> {
  let topology = sessionsTopologyFromJson(input)
  if (isEmptySessionsTopology(topology)) {
    // Encode a node of bytes32(0)
    topology = Bytes.fromHex('0x0000000000000000000000000000000000000000000000000000000000000000')
  }
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
              required: true,
            })
        },
        async (argv) => {
          // This function can also merge two topologies
          const sessionInput = argv.explicitSession
          if (!sessionInput) {
            throw new Error('Explicit session is required')
          }
          const session = sessionsTopologyFromJson(sessionInput)
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          const topology = sessionsTopologyFromJson(topologyInput)
          if (!isSessionsTopology(session)) {
            throw new Error('Explicit session must be a valid session topology')
          }
          if (!isSessionsTopology(topology) && !isEmptySessionsTopology(topology)) {
            throw new Error('Session topology must be a valid session topology')
          }
          const json = sessionsTopologyToJson(mergeSessionsTopologies(topology, session))
          console.log(json)
        },
      )
      .command(
        'remove [explicit-session-address] [session-topology]',
        'Remove a session from the session topology',
        (yargs) => {
          return yargs
            .positional('explicit-session-address', {
              type: 'string',
              description: 'Explicit session address to remove',
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to remove from',
            })
        },
        async (argv) => {
          const explicitSessionAddress = argv.explicitSessionAddress
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          const topology = sessionsTopologyFromJson(topologyInput)
          if (!isSessionsTopology(topology) && !isEmptySessionsTopology(topology)) {
            throw new Error('Session topology must be a valid session topology')
          }
          if (!explicitSessionAddress || !explicitSessionAddress.startsWith('0x')) {
            throw new Error('Explicit session address must be a valid address')
          }
          const json = sessionsTopologyToJson(
            removeSessionPermission(topology, explicitSessionAddress as `0x${string}`),
          )
          console.log(json)
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

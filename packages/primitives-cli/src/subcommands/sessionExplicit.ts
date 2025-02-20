import {
  balanceSessionsTopology,
  getSessionPermissions,
  isSessionsTopology,
  mergeSessionsTopologies,
  removeExplicitSession,
  sessionPermissionsFromJson,
  sessionsTopologyFromJson,
  sessionsTopologyToJson,
} from '@0xsequence/sequence-primitives'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

export async function doAddSession(sessionInput: string, topologyInput: string): Promise<string> {
  const session = sessionPermissionsFromJson(sessionInput)
  let topology = sessionsTopologyFromJson(topologyInput)
  if (!isSessionsTopology(session)) {
    throw new Error('Explicit session must be a valid session topology')
  }
  if (!isSessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  // Find the session in the topology
  const sessionPermissions = getSessionPermissions(topology, session.signer)
  if (sessionPermissions) {
    throw new Error('Session already exists')
  }
  // Merge the session into the topology
  topology = mergeSessionsTopologies(session, topology)
  topology = balanceSessionsTopology(topology)
  return sessionsTopologyToJson(topology)
}

export async function doRemoveSession(explicitSessionAddress: string, topologyInput: string): Promise<string> {
  const topology = sessionsTopologyFromJson(topologyInput)
  if (!isSessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  if (!explicitSessionAddress || !explicitSessionAddress.startsWith('0x')) {
    throw new Error('Explicit session address must be a valid address')
  }
  const updated = removeExplicitSession(topology, explicitSessionAddress as `0x${string}`)
  if (!updated) {
    throw new Error('Session topology is empty')
  }
  return sessionsTopologyToJson(updated)
}

const sessionExplicitCommand: CommandModule = {
  command: 'explicit',
  describe: 'Explicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'add [explicit-session] [session-topology]',
        'Add a session to the session topology',
        (yargs) => {
          return yargs
            .positional('explicit-session', {
              type: 'string',
              description: 'Explicit session to add',
              demandOption: true,
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to add to',
              demandOption: true,
            })
        },
        async (argv) => {
          const sessionInput = argv.explicitSession
          if (!sessionInput) {
            throw new Error('Explicit session is required')
          }
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doAddSession(sessionInput, topologyInput))
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
              demandOption: true,
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to remove from',
              demandOption: true,
            })
        },
        async (argv) => {
          const explicitSessionAddress = argv.explicitSessionAddress
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doRemoveSession(explicitSessionAddress!, topologyInput))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionExplicitCommand

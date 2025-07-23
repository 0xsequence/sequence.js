import { Permission, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils.js'

export async function doAddSession(sessionInput: string, topologyInput: string): Promise<string> {
  const session = Permission.sessionPermissionsFromJson(sessionInput)
  let topology = SessionConfig.sessionsTopologyFromJson(topologyInput)
  if (!SessionConfig.isSessionsTopology(session)) {
    throw new Error('Explicit session must be a valid session topology')
  }
  if (!SessionConfig.isSessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  // Find the session in the topology
  if (SessionConfig.getSessionPermissions(topology, session.signer)) {
    throw new Error('Session already exists')
  }
  // Merge the session into the topology
  topology = SessionConfig.addExplicitSession(topology, session)
  return SessionConfig.sessionsTopologyToJson(topology)
}

export async function doRemoveSession(explicitSessionAddress: Address.Address, topologyInput: string): Promise<string> {
  const topology = SessionConfig.sessionsTopologyFromJson(topologyInput)
  if (!SessionConfig.isSessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  const updated = SessionConfig.removeExplicitSession(topology, explicitSessionAddress)
  if (!updated) {
    throw new Error('Session topology is empty')
  }
  return SessionConfig.sessionsTopologyToJson(updated)
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
          Address.assert(explicitSessionAddress)

          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doRemoveSession(explicitSessionAddress, topologyInput))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionExplicitCommand

import { SessionConfig } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin, requireString } from '../utils.js'

export async function doAddBlacklistAddress(
  blacklistAddress: Address.Address,
  sessionTopologyInput: string,
): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const updated = SessionConfig.addToImplicitBlacklist(sessionTopology, blacklistAddress)
  return SessionConfig.sessionsTopologyToJson(updated)
}

export async function doRemoveBlacklistAddress(
  blacklistAddress: Address.Address,
  sessionTopologyInput: string,
): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const updated = SessionConfig.removeFromImplicitBlacklist(sessionTopology, blacklistAddress)
  return SessionConfig.sessionsTopologyToJson(updated)
}

const sessionImplicitCommand: CommandModule = {
  command: 'implicit',
  describe: 'Implicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'blacklist-add [blacklist-address] [session-topology]',
        'Add an address to the implicit session blacklist',
        (yargs) => {
          return yargs
            .positional('blacklist-address', {
              type: 'string',
              description: 'Blacklist address',
              demandOption: true,
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology',
              demandOption: true,
            })
        },
        async (argv) => {
          const blacklistAddress = argv.blacklistAddress
          requireString(blacklistAddress, 'Blacklist address')
          Address.assert(blacklistAddress)
          const sessionTopologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doAddBlacklistAddress(blacklistAddress, sessionTopologyInput))
        },
      )
      .command(
        'blacklist-remove [blacklist-address] [session-topology]',
        'Remove an address from the implicit session blacklist',
        (yargs) => {
          return yargs
            .positional('blacklist-address', {
              type: 'string',
              description: 'Blacklist address',
              demandOption: true,
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology',
              demandOption: true,
            })
        },
        async (argv) => {
          const blacklistAddress = argv.blacklistAddress
          if (!blacklistAddress) {
            throw new Error('Blacklist address is required')
          }
          Address.assert(blacklistAddress)
          const sessionTopologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doRemoveBlacklistAddress(blacklistAddress, sessionTopologyInput))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for implicit session')
  },
  handler: () => {},
}

export default sessionImplicitCommand

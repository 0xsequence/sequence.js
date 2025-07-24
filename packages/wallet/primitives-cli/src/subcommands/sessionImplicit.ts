import { Address, SessionConfig } from '@0xsequence/wallet-primitives'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils.js'

export async function doAddBlacklistAddress(
  blacklistAddress: Address.Checksummed,
  sessionTopologyInput: string,
): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const updated = SessionConfig.addToImplicitBlacklist(sessionTopology, blacklistAddress)
  return SessionConfig.sessionsTopologyToJson(updated)
}

export async function doRemoveBlacklistAddress(
  blacklistAddress: Address.Checksummed,
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
          const blacklistAddress = Address.checksum(argv.blacklistAddress)
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
          const blacklistAddress = Address.checksum(argv.blacklistAddress)
          const sessionTopologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doRemoveBlacklistAddress(blacklistAddress, sessionTopologyInput))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for implicit session')
  },
  handler: () => {},
}

export default sessionImplicitCommand

import { addToImplicitBlacklist, removeFromImplicitBlacklist, SessionsTopology } from '@0xsequence/sequence-primitives'
import { Address } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin, requireString } from '../utils'

export async function doAddBlacklistAddress(
  blacklistAddress: string,
  sessionConfigurationInput: string,
): Promise<string> {
  const sessionConfiguration = JSON.parse(sessionConfigurationInput) as SessionsTopology
  const updated = addToImplicitBlacklist(sessionConfiguration, blacklistAddress as Address.Address)
  return JSON.stringify(updated)
}

export async function doRemoveBlacklistAddress(
  blacklistAddress: string,
  sessionConfigurationInput: string,
): Promise<string> {
  const sessionConfiguration = JSON.parse(sessionConfigurationInput) as SessionsTopology
  const updated = removeFromImplicitBlacklist(sessionConfiguration, blacklistAddress as Address.Address)
  return JSON.stringify(updated)
}

const sessionImplicitCommand: CommandModule = {
  command: 'implicit',
  describe: 'Implicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'blacklist-add [blacklist-address] [session-configuration]',
        'Add an address to the implicit session blacklist',
        (yargs) => {
          return yargs
            .positional('blacklist-address', {
              type: 'string',
              description: 'Blacklist address',
              demandOption: true,
            })
            .positional('session-configuration', {
              type: 'string',
              description: 'Session configuration',
              demandOption: true,
            })
        },
        async (argv) => {
          const blacklistAddress = argv.blacklistAddress
          requireString(blacklistAddress, 'Blacklist address')
          const sessionConfigurationInput = await fromPosOrStdin(argv, 'session-configuration')
          console.log(await doAddBlacklistAddress(blacklistAddress, sessionConfigurationInput))
        },
      )
      .command(
        'blacklist-remove [blacklist-address] [session-configuration]',
        'Remove an address from the implicit session blacklist',
        (yargs) => {
          return yargs
            .positional('blacklist-address', {
              type: 'string',
              description: 'Blacklist address',
              demandOption: true,
            })
            .positional('session-configuration', {
              type: 'string',
              description: 'Session configuration',
              demandOption: true,
            })
        },
        async (argv) => {
          const blacklistAddress = argv.blacklistAddress as string
          if (!blacklistAddress) {
            throw new Error('Blacklist address is required')
          }
          const sessionConfigurationInput = await fromPosOrStdin(argv, 'session-configuration')
          console.log(await doRemoveBlacklistAddress(blacklistAddress, sessionConfigurationInput))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for implicit session')
  },
  handler: () => {},
}

export default sessionImplicitCommand

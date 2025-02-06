import type { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit'

const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Session utilities',
  builder: (yargs) => {
    return yargs.command(sessionExplicitCommand).demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

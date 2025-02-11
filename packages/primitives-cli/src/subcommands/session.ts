import { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit'
import sessionImplicitCommand from './sessionImplicit'

const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Session utilities',
  builder: (yargs) => {
    return yargs
      .command(sessionExplicitCommand)
      .command(sessionImplicitCommand)
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

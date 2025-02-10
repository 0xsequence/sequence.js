#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import payloadCommand from './subcommands/payload'
import configCommand from './subcommands/config'
import devToolsCommand from './subcommands/devTools'
import signatureCommand from './subcommands/signature'
import permissionCommand from './subcommands/permission'
import sessionCommand from './subcommands/session'
import serverCommand from './subcommands/server'

void yargs(hideBin(process.argv))
  .command(payloadCommand)
  .command(configCommand)
  .command(devToolsCommand)
  .command(signatureCommand)
  .command(permissionCommand) //FIXME Not sure we need to expose this
  .command(sessionCommand)
  .command(serverCommand)
  .demandCommand(1)
  .strict()
  .help().argv

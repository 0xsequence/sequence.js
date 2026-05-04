#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import payloadCommand from './subcommands/payload.js'
import configCommand from './subcommands/config.js'
import devToolsCommand from './subcommands/devTools.js'
import signatureCommand from './subcommands/signature.js'
import sessionCommand from './subcommands/session.js'
import serverCommand from './subcommands/server.js'
import addressCommand from './subcommands/address.js'
import recoveryCommand from './subcommands/recovery.js'
import passkeysCommand from './subcommands/passkeys.js'
import stateCommand from './subcommands/state.js'

void yargs(hideBin(process.argv))
  .command(payloadCommand)
  .command(configCommand)
  .command(devToolsCommand)
  .command(signatureCommand)
  .command(sessionCommand)
  .command(serverCommand)
  .command(addressCommand)
  .command(recoveryCommand)
  .command(passkeysCommand)
  .command(stateCommand)
  .demandCommand(1)
  .strict()
  .help().argv

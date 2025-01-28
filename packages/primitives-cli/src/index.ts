#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import payloadCommand from './subcommands/payload'
import configCommand from './subcommands/config'
import devToolsCommand from './subcommands/devTools'
import signatureCommand from './subcommands/signature'

void yargs(hideBin(process.argv))
  .command(payloadCommand)
  .command(configCommand)
  .command(devToolsCommand)
  .command(signatureCommand)
  .demandCommand(1)
  .strict()
  .help().argv

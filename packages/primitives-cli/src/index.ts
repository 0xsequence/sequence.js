#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import payloadCommand from './subcommands/payload'
import configCommand from './subcommands/config'

void yargs(hideBin(process.argv))
  .command(payloadCommand)
  .command(configCommand)
  .demandCommand(1)
  .strict()
  .help().argv

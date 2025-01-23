#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import payloadCommand from './subcommands/payload'

void yargs(hideBin(process.argv)).command(payloadCommand).demandCommand(1).strict().help().argv

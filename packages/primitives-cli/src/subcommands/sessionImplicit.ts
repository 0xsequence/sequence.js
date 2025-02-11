// packages/primitives-cli/src/subcommands/sessionImplicit.ts

import {
  ImplicitSessionConfiguration,
  addToImplicitSessionBlacklist,
  attestationFromJson,
  emptyImplicitSessionConfiguration,
  encodeImplicitSessionSignature,
  removeFromImplicitSessionBlacklist,
} from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin, parseRSV, requireString } from '../utils'

export async function doEmptySession(): Promise<string> {
  return JSON.stringify(emptyImplicitSessionConfiguration())
}

export async function doAddBlacklistAddress(
  blacklistAddress: string,
  sessionConfigurationInput: string,
): Promise<string> {
  const sessionConfiguration = JSON.parse(sessionConfigurationInput) as ImplicitSessionConfiguration
  const updated = addToImplicitSessionBlacklist(sessionConfiguration, blacklistAddress)
  return JSON.stringify(updated)
}

export async function doRemoveBlacklistAddress(
  blacklistAddress: string,
  sessionConfigurationInput: string,
): Promise<string> {
  const sessionConfiguration = JSON.parse(sessionConfigurationInput) as ImplicitSessionConfiguration
  const updated = removeFromImplicitSessionBlacklist(sessionConfiguration, blacklistAddress)
  return JSON.stringify(updated)
}

export async function doUseImplicitSession(
  sessionSigInput: string,
  globalSigInput: string,
  attestationInput: string,
  sessionConfigurationInput: string,
): Promise<string> {
  const sessionSig = parseRSV(sessionSigInput)
  const globalSig = parseRSV(globalSigInput)
  const attestation = attestationFromJson(attestationInput)
  const sessionConfiguration = JSON.parse(sessionConfigurationInput) as ImplicitSessionConfiguration
  const encoded = encodeImplicitSessionSignature(sessionSig, attestation, globalSig, sessionConfiguration)
  return Hex.from(encoded)
}
const sessionImplicitCommand: CommandModule = {
  command: 'implicit',
  describe: 'Implicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'empty',
        'Create an empty implicit session topology',
        () => {},
        async () => {
          console.log(await doEmptySession())
        },
      )
      .command(
        'blacklist-add [blacklist-address] [session-configuration]',
        'Add an address to the implicit session blacklist',
        (yargs) => {
          return yargs
            .positional('blacklist-address', {
              type: 'string',
              description: 'Blacklist address',
              required: true,
            })
            .positional('session-configuration', {
              type: 'string',
              description: 'Session configuration',
              required: true,
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
              required: true,
            })
            .positional('session-configuration', {
              type: 'string',
              description: 'Session configuration',
              required: true,
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
      .command(
        'use [session-signature] [global-signature] [attestation] [session-configuration]',
        'Encode an implicit session signature',
        (yargs) => {
          return yargs
            .positional('session-signature', {
              type: 'string',
              description: 'Session signature in r:s:v format',
              required: true,
            })
            .positional('global-signature', {
              type: 'string',
              description: 'Global signature in r:s:v format',
              required: true,
            })
            .positional('attestation', {
              type: 'string',
              description: 'Attestation in r:s:v format',
              required: true,
            })
            .positional('session-configuration', {
              type: 'string',
              description: 'Session configuration',
              required: true,
            })
        },
        async (argv) => {
          const sessionSigStr = argv.sessionSignature
          requireString(sessionSigStr, 'Session signature')
          const globalSigStr = argv.globalSignature
          requireString(globalSigStr, 'Global signature')
          const attestationInput = argv.attestation
          requireString(attestationInput, 'Attestation')
          const sessionConfigurationInput = await fromPosOrStdin(argv, 'session-configuration')
          console.log(
            await doUseImplicitSession(sessionSigStr, globalSigStr, attestationInput, sessionConfigurationInput),
          )
        },
      )
      .demandCommand(1, 'You must specify a subcommand for implicit session')
  },
  handler: () => {},
}

export default sessionImplicitCommand

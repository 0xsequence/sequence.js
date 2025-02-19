import {
  addToImplicitBlacklist,
  attestationFromJson,
  encodeImplicitSessionCallSignature,
  removeFromImplicitBlacklist,
  SessionsTopology,
} from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin, parseRSV, requireString } from '../utils'

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

export async function doEncodeImplicitSessionCallSignature(
  attestationInput: string,
  globalSigInput: string,
  sessionSigInput: string,
): Promise<string> {
  const attestation = attestationFromJson(attestationInput)
  const globalSig = parseRSV(globalSigInput)
  const sessionSig = parseRSV(sessionSigInput)
  const encoded = encodeImplicitSessionCallSignature(attestation, globalSig, sessionSig)
  return Hex.from(encoded)
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
      .command(
        'encode-call [attestation] [global-signature] [session-signature]',
        'Encode an implicit session signature',
        (yargs) => {
          return yargs
            .positional('attestation', {
              type: 'string',
              description: 'Attestation for the implicit session',
              demandOption: true,
            })
            .positional('global-signature', {
              type: 'string',
              description: 'Global signature in r:s:v format',
              demandOption: true,
            })
            .positional('session-signature', {
              type: 'string',
              description: 'Session signature in r:s:v format',
              demandOption: true,
            })
        },
        async (argv) => {
          const sessionSigStr = argv.sessionSignature
          requireString(sessionSigStr, 'Session signature')
          const globalSigStr = argv.globalSignature
          requireString(globalSigStr, 'Global signature')
          const attestationInput = argv.attestation
          requireString(attestationInput, 'Attestation')
          console.log(await doEncodeImplicitSessionCallSignature(attestationInput, globalSigStr, sessionSigStr))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for implicit session')
  },
  handler: () => {},
}

export default sessionImplicitCommand

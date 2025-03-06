import { Hex } from 'ox'
import { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit'
import sessionImplicitCommand from './sessionImplicit'

import { GenericTree, SessionConfig, SessionSignature, Config } from '@0xsequence/sequence-primitives'

export async function doEmptyTopology(identitySigner: `0x${string}`): Promise<string> {
  const topology = SessionConfig.emptySessionsTopology(identitySigner)
  return SessionConfig.sessionsTopologyToJson(topology)
}

export async function doEncodeConfiguration(sessionConfigurationInput: string): Promise<string> {
  const sessionConfiguration = SessionConfig.sessionsTopologyFromJson(sessionConfigurationInput)
  const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionConfiguration)
  return JSON.stringify(configurationTree)
}

export async function doEncodeSessionCallSignatures(
  sessionConfigurationInput: string,
  callSignaturesInput: string[],
  explicitSigners: string[] = [],
  implicitSigners: string[] = [],
): Promise<string> {
  const sessionConfiguration = SessionConfig.sessionsTopologyFromJson(sessionConfigurationInput)
  const callSignatures = callSignaturesInput.map((s) => SessionSignature.sessionCallSignatureFromJson(s))
  const encoded = SessionSignature.encodeSessionCallSignatures(
    callSignatures,
    sessionConfiguration,
    explicitSigners as `0x${string}`[],
    implicitSigners as `0x${string}`[],
  )
  return Hex.from(encoded)
}

export async function doImageHash(sessionConfigurationInput: string): Promise<string> {
  const sessionConfiguration = SessionConfig.sessionsTopologyFromJson(sessionConfigurationInput)
  const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionConfiguration)
  const hash = GenericTree.hash(configurationTree)
  return Hex.from(hash)
}

const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'empty [identity-signer]',
        'Create an empty session topology with the given identity signer',
        (yargs) => {
          return yargs.positional('identity-signer', {
            type: 'string',
            description: 'The identity signer for the session topology',
            demandOption: true,
            alias: 'i',
          })
        },
        async (args) => {
          console.log(await doEmptyTopology(args.identitySigner as `0x${string}`))
        },
      )
      .command(
        'encode-configuration [session-configuration]',
        'Encode a session configuration',
        (yargs) => {
          return yargs.positional('session-configuration', {
            type: 'string',
            description: 'The session configuration',
            demandOption: true,
          })
        },
        async (args) => {
          console.log(await doEncodeConfiguration(args.sessionConfiguration))
        },
      )
      .command(
        'encode-calls [session-configuration] [call-signatures] [explicit-signers] [implicit-signers]',
        'Encode a call signature for an implicit session',
        (yargs) => {
          return yargs
            .positional('session-configuration', {
              type: 'string',
              description: 'The session configuration',
              demandOption: true,
            })
            .positional('call-signatures', {
              type: 'string',
              array: true,
              description: 'The call signatures',
              demandOption: true,
            })
            .option('explicit-signers', {
              type: 'string',
              array: true,
              description: 'The explicit signers',
              demandOption: false,
              default: [],
              alias: 'e',
            })
            .option('implicit-signers', {
              type: 'string',
              array: true,
              description: 'The implicit signers',
              demandOption: false,
              default: [],
              alias: 'i',
            })
        },
        async (args) => {
          console.log(
            await doEncodeSessionCallSignatures(
              args.sessionConfiguration,
              args.callSignatures,
              args.explicitSigners,
              args.implicitSigners,
            ),
          )
        },
      )
      .command(
        'image-hash [session-configuration]',
        'Hash a session configuration',
        (yargs) => {
          return yargs.positional('session-configuration', {
            type: 'string',
            description: 'The session configuration',
            demandOption: true,
          })
        },
        async (args) => {
          console.log(await doImageHash(args.sessionConfiguration))
        },
      )
      .command(sessionExplicitCommand)
      .command(sessionImplicitCommand)
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

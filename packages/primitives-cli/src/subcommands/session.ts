import { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit'
import sessionImplicitCommand from './sessionImplicit'
import {
  emptySessionsTopology,
  hashConfigurationTree,
  sessionsTopologyFromJson,
  sessionsTopologyToConfigurationTree,
  sessionsTopologyToJson,
} from '@0xsequence/sequence-primitives'
import { encodeSessionCallSignatures } from '@0xsequence/sequence-primitives'
import { Bytes, Hex } from 'ox'

export async function doEmptyTopology(globalSigner: `0x${string}`): Promise<string> {
  const topology = emptySessionsTopology(globalSigner)
  return sessionsTopologyToJson(topology)
}

export async function doEncodeSessionCallSignatures(
  sessionConfigurationInput: string,
  callSignaturesInput: string[],
  explicitSigners: string[] = [],
  implicitSigners: string[] = [],
): Promise<string> {
  const sessionConfiguration = sessionsTopologyFromJson(sessionConfigurationInput)
  const callSignatures = callSignaturesInput.map((s) => Bytes.fromHex(s as `0x${string}`))
  const encoded = encodeSessionCallSignatures(
    callSignatures,
    sessionConfiguration,
    explicitSigners as `0x${string}`[],
    implicitSigners as `0x${string}`[],
  )
  return Hex.from(encoded)
}

export async function doImageHash(sessionConfigurationInput: string): Promise<string> {
  const sessionConfiguration = sessionsTopologyFromJson(sessionConfigurationInput)
  const configurationTree = sessionsTopologyToConfigurationTree(sessionConfiguration)
  const hash = hashConfigurationTree(configurationTree)
  return Hex.from(hash)
}

const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'empty [global-signer]',
        'Create an empty session topology with the given global signer',
        (yargs) => {
          return yargs.positional('global-signer', {
            type: 'string',
            description: 'The global signer for the session topology',
            demandOption: true,
            alias: 'g',
          })
        },
        async (args) => {
          console.log(await doEmptyTopology(args.globalSigner as `0x${string}`))
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

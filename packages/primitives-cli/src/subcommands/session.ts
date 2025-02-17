import { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit'
import sessionImplicitCommand from './sessionImplicit'
import {
  emptySessionsTopology,
  sessionsTopologyFromJson,
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
  includesImplicitSignature: boolean,
): Promise<string> {
  const sessionConfiguration = sessionsTopologyFromJson(sessionConfigurationInput)
  const callSignatures = callSignaturesInput.map((s) => Bytes.fromHex(s as `0x${string}`))
  const encoded = encodeSessionCallSignatures(callSignatures, sessionConfiguration, includesImplicitSignature)
  return Hex.from(encoded)
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
        'encode-calls [session-configuration] [call-signatures] [includes-implicit-signature]',
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
            .option('includes-implicit-signature', {
              type: 'boolean',
              description: 'Whether an implicit signature is included',
              demandOption: false,
              default: false,
              alias: 'i',
            })
        },
        async (args) => {
          console.log(
            await doEncodeSessionCallSignatures(
              args.sessionConfiguration,
              args.callSignatures,
              args.includesImplicitSignature,
            ),
          )
        },
      )
      .command(sessionExplicitCommand)
      .command(sessionImplicitCommand)
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

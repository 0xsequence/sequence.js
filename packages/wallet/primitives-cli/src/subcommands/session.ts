import { Hex } from 'ox'
import { CommandModule } from 'yargs'
import sessionExplicitCommand from './sessionExplicit.js'
import sessionImplicitCommand from './sessionImplicit.js'

import { GenericTree, SessionConfig, SessionSignature } from '@0xsequence/wallet-primitives'

export async function doEmptyTopology(identitySigner: Address.Address): Promise<string> {
  const topology = SessionConfig.emptySessionsTopology(identitySigner)
  return SessionConfig.sessionsTopologyToJson(topology)
}

export async function doEncodeTopology(sessionTopologyInput: string): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const encoded = SessionConfig.encodeSessionsTopology(sessionTopology)
  return Hex.from(encoded)
}

export async function doEncodeSessionCallSignatures(
  sessionTopologyInput: string,
  callSignaturesInput: string[],
  explicitSigners: Address.Address[] = [],
  implicitSigners: Address.Address[] = [],
): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const callSignatures = callSignaturesInput.map((s) => SessionSignature.sessionCallSignatureFromJson(s))
  const encoded = SessionSignature.encodeSessionCallSignatures(
    callSignatures,
    sessionTopology,
    explicitSigners,
    implicitSigners,
  )
  return Hex.from(encoded)
}

export async function doImageHash(sessionTopologyInput: string): Promise<string> {
  const sessionTopology = SessionConfig.sessionsTopologyFromJson(sessionTopologyInput)
  const encoded = SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology)
  const hash = GenericTree.hash(encoded)
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
          Address.assert(args.identitySigner)
          console.log(await doEmptyTopology(args.identitySigner))
        },
      )
      .command(
        'encode-topology [session-topology]',
        'Encode a session topology',
        (yargs) => {
          return yargs.positional('session-topology', {
            type: 'string',
            description: 'The session topology',
            demandOption: true,
          })
        },
        async (args) => {
          console.log(await doEncodeTopology(args.sessionTopology))
        },
      )
      .command(
        'encode-calls [session-topology] [call-signatures] [explicit-signers] [implicit-signers]',
        'Encode call signatures for sessions',
        (yargs) => {
          return yargs
            .positional('session-topology', {
              type: 'string',
              description: 'The session topology',
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
              args.sessionTopology,
              args.callSignatures,
              args.explicitSigners.map((signer) => {
                Address.assert(signer)
                return signer
              }),
              args.implicitSigners.map((signer) => {
                Address.assert(signer)
                return signer
              }),
            ),
          )
        },
      )
      .command(
        'image-hash [session-topology]',
        'Hash a session topology',
        (yargs) => {
          return yargs.positional('session-topology', {
            type: 'string',
            description: 'The session topology',
            demandOption: true,
          })
        },
        async (args) => {
          console.log(await doImageHash(args.sessionTopology))
        },
      )
      .command(sessionExplicitCommand)
      .command(sessionImplicitCommand)
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionCommand

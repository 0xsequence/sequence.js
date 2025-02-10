import {
  encodeSessionsTopology,
  encodeExplicitSessionSignature,
  isEmptySessionsTopology,
  isSessionsTopology,
  mergeSessionsTopologies,
  removeSessionPermission,
  sessionsTopologyFromJson,
  sessionsTopologyToJson,
} from '@0xsequence/sequence-primitives'
import { Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

export async function doEncodeSessionsTopology(input: string): Promise<string> {
  let topology = sessionsTopologyFromJson(input)
  if (isEmptySessionsTopology(topology)) {
    // Encode a node of bytes32(0)
    topology = Bytes.fromHex('0x0000000000000000000000000000000000000000000000000000000000000000')
  }
  const packed = encodeSessionsTopology(topology)
  return Hex.from(packed)
}

export async function doEmptySession(): Promise<string> {
  return JSON.stringify([])
}

export async function doAddSession(sessionInput: string, topologyInput: string): Promise<string> {
  const session = sessionsTopologyFromJson(sessionInput)
  const topology = sessionsTopologyFromJson(topologyInput)
  if (!isSessionsTopology(session)) {
    throw new Error('Explicit session must be a valid session topology')
  }
  if (!isSessionsTopology(topology) && !isEmptySessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  return sessionsTopologyToJson(mergeSessionsTopologies(topology, session))
}

export async function doRemoveSession(explicitSessionAddress: string, topologyInput: string): Promise<string> {
  const topology = sessionsTopologyFromJson(topologyInput)
  if (!isSessionsTopology(topology) && !isEmptySessionsTopology(topology)) {
    throw new Error('Session topology must be a valid session topology')
  }
  if (!explicitSessionAddress || !explicitSessionAddress.startsWith('0x')) {
    throw new Error('Explicit session address must be a valid address')
  }
  return sessionsTopologyToJson(removeSessionPermission(topology, explicitSessionAddress as `0x${string}`))
}

export async function doUseSession(
  signatureInput: string,
  permissionIndexesInput: string,
  topologyInput: string,
): Promise<string> {
  if (!signatureInput) {
    throw new Error('Signature is required')
  }
  // Decode signature from "r:s:v"
  const signatureParts = signatureInput.split(':')
  if (signatureParts.length !== 3) {
    throw new Error('Signature must be in r:s:v format')
  }
  const signature = {
    r: Bytes.fromHex(signatureParts[0] as `0x${string}`),
    s: Bytes.fromHex(signatureParts[1] as `0x${string}`),
    v: parseInt(signatureParts[2] ?? ''),
  }

  if (!permissionIndexesInput) {
    throw new Error('Permission indexes are required')
  }
  const permissionIndexes = permissionIndexesInput.split(',').map((index) => parseInt(index))
  //TODO Validate that the permission index is valid
  const topology = sessionsTopologyFromJson(topologyInput)
  const encoded = encodeExplicitSessionSignature(topology, permissionIndexes, signature)
  return Hex.from(encoded)
}

const sessionExplicitCommand: CommandModule = {
  command: 'explicit',
  describe: 'Explicit session utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'empty',
        'Create an empty session topology',
        () => {},
        async () => {
          console.log(await doEmptySession())
        },
      )
      .command(
        'add [explicit-session] [session-topology]',
        'Add a session to the session topology',
        (yargs) => {
          return yargs
            .positional('explicit-session', {
              type: 'string',
              description: 'Explicit session to add',
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to add to',
              required: true,
            })
        },
        async (argv) => {
          const sessionInput = argv.explicitSession
          if (!sessionInput) {
            throw new Error('Explicit session is required')
          }
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doAddSession(sessionInput, topologyInput))
        },
      )
      .command(
        'remove [explicit-session-address] [session-topology]',
        'Remove a session from the session topology',
        (yargs) => {
          return yargs
            .positional('explicit-session-address', {
              type: 'string',
              description: 'Explicit session address to remove',
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to remove from',
            })
        },
        async (argv) => {
          const explicitSessionAddress = argv.explicitSessionAddress
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doRemoveSession(explicitSessionAddress!, topologyInput))
        },
      )
      .command(
        'use [signature] [permission-indexes] [session-topology]',
        'Encode a signature with the given session topology',
        (yargs) => {
          return yargs
            .positional('signature', {
              type: 'string',
              description: 'Signature to encode (r:s:v)',
            })
            .positional('permission-indexes', {
              type: 'string',
              description: 'Indexes of the permissions to use (comma separated)',
            })
            .positional('session-topology', {
              type: 'string',
              description: 'Session topology to use',
            })
        },
        async (argv) => {
          const signatureInput = argv.signature
          if (!signatureInput) {
            throw new Error('Signature is required')
          }
          const permissionIndexesInput = argv.permissionIndexes
          if (!permissionIndexesInput) {
            throw new Error('Permission indexes are required')
          }
          const topologyInput = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doUseSession(signatureInput, permissionIndexesInput, topologyInput))
        },
      )
      .command(
        'to-packed-topology [session-topology]',
        'Convert session topology to packed format',
        (yargs) => {
          return yargs.positional('session-topology', {
            type: 'string',
            description: 'Input session topology to convert',
          })
        },
        async (argv) => {
          const permission = await fromPosOrStdin(argv, 'session-topology')
          console.log(await doEncodeSessionsTopology(permission))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for session')
  },
  handler: () => {},
}

export default sessionExplicitCommand

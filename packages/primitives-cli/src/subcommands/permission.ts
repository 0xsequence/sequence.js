import {
  encodePermission,
  encodeSessionPermissions,
  permissionFromJson,
  sessionPermissionsFromJson,
} from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

export async function doEncodeSessionPermissions(input: string): Promise<string> {
  const permission = sessionPermissionsFromJson(input)
  const packed = encodeSessionPermissions(permission)
  return Hex.from(packed)
}

export async function doEncodePermission(input: string): Promise<string> {
  const permission = permissionFromJson(input)
  const packed = encodePermission(permission)
  return Hex.from(packed)
}

const permissionCommand: CommandModule = {
  command: 'permission',
  describe: 'Permission conversion utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'to-packed-session [session-permission]',
        'Convert session permission to packed format',
        (yargs) => {
          return yargs.positional('session-permission', {
            type: 'string',
            description: 'Input permission to convert',
          })
        },
        async (argv) => {
          const permission = await fromPosOrStdin(argv, 'session-permission')
          const result = await doEncodeSessionPermissions(permission)
          console.log(result)
        },
      )
      .command(
        'to-packed [permission]',
        'Convert permission to packed format',
        (yargs) => {
          return yargs.positional('permission', {
            type: 'string',
            description: 'Input permission to convert',
          })
        },
        async (argv) => {
          const permission = await fromPosOrStdin(argv, 'permission')
          const result = await doEncodePermission(permission)
          console.log(result)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for permission')
  },
  handler: () => {},
}

export default permissionCommand

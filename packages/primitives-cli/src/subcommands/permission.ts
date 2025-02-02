import {
  encodePermission,
  encodeSessionPermission,
  permissionFromJson,
  sessionPermissionFromJson,
} from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncodeSessionPermission(input: string): Promise<void> {
  const permission = sessionPermissionFromJson(input)
  const packed = encodeSessionPermission(permission)
  console.log(Hex.from(packed))
}

async function doEncodePermission(input: string): Promise<void> {
  const permission = permissionFromJson(input)
  const packed = encodePermission(permission)
  console.log(Hex.from(packed))
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
          await doEncodeSessionPermission(permission)
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
          await doEncodePermission(permission)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for permission')
  },
  handler: () => {},
}

export default permissionCommand

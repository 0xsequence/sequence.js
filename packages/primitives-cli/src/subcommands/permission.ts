import { encodePermission, permissionFromJson } from '@0xsequence/sequence-primitives'
import { Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'

async function doEncode(input: string): Promise<void> {
  const permission = permissionFromJson(input)
  const packed = encodePermission(permission)
  console.log(Hex.from(packed))
}

async function convertToJson(permission: string): Promise<void> {
  throw new Error('Not implemented')
}

const permissionCommand: CommandModule = {
  command: 'permission',
  describe: 'Permission conversion utilities',
  builder: (yargs) => {
    return yargs
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
          await doEncode(permission)
        },
      )
      .command(
        'to-json [permission]',
        'Convert permission to JSON format',
        (yargs) => {
          return yargs.positional('permission', {
            type: 'string',
            description: 'Input permission to convert',
          })
        },
        async (argv) => {
          const permission = await fromPosOrStdin(argv, 'permission')
          await convertToJson(permission)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for permission')
  },
  handler: () => {},
}

export default permissionCommand

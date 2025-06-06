import { Address, Bytes } from 'ox'
import type { CommandModule } from 'yargs'
import { Constants, Address as SequenceAddress, Context } from '@0xsequence/wallet-primitives'

export async function doCalculateAddress(options: {
  imageHash: string
  factory: string
  module: string
  creationCode?: string
}): Promise<string> {
  const context = {
    factory: Address.from(options.factory),
    stage1: Address.from(options.module),
    creationCode: (options.creationCode || Context.Dev2.creationCode) as `0x${string}`,
  }

  return SequenceAddress.from(Bytes.fromHex(options.imageHash as `0x${string}`), context)
}

const addressCommand: CommandModule = {
  command: 'address',
  describe: 'Address utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'calculate <imageHash> <factory> <module>',
        'Calculate counterfactual wallet address',
        (yargs) => {
          return yargs
            .positional('imageHash', {
              type: 'string',
              description: 'Image hash of the wallet',
              demandOption: true,
            })
            .positional('factory', {
              type: 'string',
              description: 'Factory address',
              demandOption: true,
            })
            .positional('module', {
              type: 'string',
              description: 'Stage1 address',
              demandOption: true,
            })
            .option('creationCode', {
              type: 'string',
              description: 'Creation code (optional)',
              default: Context.Dev2.creationCode,
            })
        },
        async (argv) => {
          const { imageHash, factory, module, creationCode } = argv
          console.log(
            await doCalculateAddress({
              imageHash: imageHash!,
              factory: factory!,
              module: module!,
              creationCode,
            }),
          )
        },
      )
      .demandCommand(1, 'You must specify a subcommand for address')
  },
  handler: () => {},
}

export default addressCommand

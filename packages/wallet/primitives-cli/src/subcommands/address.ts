import { Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { Address as SequenceAddress, Context } from '@0xsequence/wallet-primitives'

export async function doCalculateAddress(options: {
  imageHash: Hex.Hex
  factory: Address.Address
  module: Address.Address
  creationCode?: Hex.Hex
}): Promise<string> {
  const context = {
    factory: options.factory,
    stage1: options.module,
    creationCode: options.creationCode || Context.Dev2.creationCode,
  }

  return SequenceAddress.from(Bytes.fromHex(options.imageHash), context)
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
              default: Context.Dev1.creationCode,
            })
        },
        async (argv) => {
          const { imageHash, factory, module, creationCode } = argv

          Hex.assert(imageHash)
          Address.assert(factory)
          Address.assert(module)
          Hex.assert(creationCode)

          console.log(
            await doCalculateAddress({
              imageHash,
              factory,
              module,
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

import { Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { Address, Context } from '@0xsequence/wallet-primitives'

export async function doCalculateAddress(options: {
  imageHash: Hex.Hex
  factory: Address.Checksummed
  module: Address.Checksummed
  creationCode?: Hex.Hex
}): Promise<string> {
  const context = {
    factory: options.factory,
    stage1: options.module,
    creationCode: options.creationCode || Context.Dev2.creationCode,
  }

  return Address.fromDeployConfiguration(Bytes.fromHex(options.imageHash), context)
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
          Hex.assert(creationCode)

          console.log(
            await doCalculateAddress({
              imageHash,
              factory: Address.checksum(factory),
              module: Address.checksum(module),
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

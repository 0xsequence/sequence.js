import type { CommandModule } from 'yargs'
import { Address, Hex } from 'ox'
import { Config, Context, GenericTree, Payload, Signature, Utils } from '@0xsequence/wallet-primitives'
import { State } from '@0xsequence/wallet-core'
import { fromPosOrStdin } from '../utils.js'

const DEFAULT_ENDPOINT = 'https://v3-keymachine.sequence-dev.app'

// Reader methods
export async function doGetConfiguration(endpoint: string, imageHash: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getConfiguration(imageHash as Hex.Hex)
  return result ? Utils.toJSON(result) : 'null'
}

export async function doGetDeploy(endpoint: string, wallet: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getDeploy(Address.from(wallet))
  return result ? Utils.toJSON(result) : 'null'
}

export async function doGetWallets(endpoint: string, signer: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getWallets(Address.from(signer))
  return Utils.toJSON(result)
}

export async function doGetWalletsForSapient(endpoint: string, signer: string, imageHash: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getWalletsForSapient(Address.from(signer), imageHash as Hex.Hex)
  return Utils.toJSON(result)
}

export async function doGetWitnessFor(endpoint: string, wallet: string, signer: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getWitnessFor(Address.from(wallet), Address.from(signer))
  return result ? Utils.toJSON(result) : 'null'
}

export async function doGetWitnessForSapient(
  endpoint: string,
  wallet: string,
  signer: string,
  imageHash: string,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getWitnessForSapient(Address.from(wallet), Address.from(signer), imageHash as Hex.Hex)
  return result ? Utils.toJSON(result) : 'null'
}

export async function doGetConfigurationUpdates(
  endpoint: string,
  wallet: string,
  fromImageHash: string,
  allUpdates?: boolean,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getConfigurationUpdates(Address.from(wallet), fromImageHash as Hex.Hex, { allUpdates })
  return Utils.toJSON(result)
}

export async function doGetTree(endpoint: string, rootHash: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getTree(rootHash as Hex.Hex)
  return result ? Utils.toJSON(result) : 'null'
}

export async function doGetPayload(endpoint: string, opHash: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const result = await provider.getPayload(opHash as Hex.Hex)
  return result ? Utils.toJSON(result) : 'null'
}

// Writer methods
export async function doSaveWallet(
  endpoint: string,
  deployConfigurationJson: string,
  contextJson: string,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const deployConfiguration = Utils.fromJSON(deployConfigurationJson) as Config.Config
  const context = Utils.fromJSON(contextJson) as Context.Context
  await provider.saveWallet(deployConfiguration, context)
  return 'Success'
}

export async function doSaveWitnesses(
  endpoint: string,
  wallet: string,
  chainId: string,
  payloadJson: string,
  signaturesJson: string,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const payload = Utils.fromJSON(payloadJson) as Payload.Parented
  const signatures = Utils.fromJSON(signaturesJson) as Signature.RawTopology
  await provider.saveWitnesses(Address.from(wallet), parseInt(chainId), payload, signatures)
  return 'Success'
}

export async function doSaveUpdate(
  endpoint: string,
  wallet: string,
  configurationJson: string,
  signatureJson: string,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const configuration = Utils.fromJSON(configurationJson) as Config.Config
  const signature = Utils.fromJSON(signatureJson) as Signature.RawSignature
  await provider.saveUpdate(Address.from(wallet), configuration, signature)
  return 'Success'
}

export async function doSaveTree(endpoint: string, treeJson: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const tree = Utils.fromJSON(treeJson) as GenericTree.Tree
  await provider.saveTree(tree)
  return 'Success'
}

export async function doSaveConfiguration(endpoint: string, configJson: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const config = Utils.fromJSON(configJson) as Config.Config
  await provider.saveConfiguration(config)
  return 'Success'
}

export async function doSaveDeploy(endpoint: string, imageHash: string, contextJson: string): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const context = Utils.fromJSON(contextJson) as Context.Context
  await provider.saveDeploy(imageHash as Hex.Hex, context)
  return 'Success'
}

export async function doSavePayload(
  endpoint: string,
  wallet: string,
  payloadJson: string,
  chainId: string,
): Promise<string> {
  const provider = new State.Sequence.Provider(endpoint)
  const payload = Utils.fromJSON(payloadJson) as Payload.Parented
  await provider.savePayload(Address.from(wallet), payload, parseInt(chainId))
  return 'Success'
}

const stateCommand: CommandModule = {
  command: 'state',
  describe: 'State provider operations',
  builder: (yargs) => {
    return (
      yargs
        .option('endpoint', {
          type: 'string',
          description: 'State provider endpoint URL',
          default: DEFAULT_ENDPOINT,
          alias: 'e',
        })
        // Reader commands
        .command(
          'get-configuration <imageHash>',
          'Get configuration by image hash',
          (yargs) => {
            return yargs.positional('imageHash', {
              type: 'string',
              description: 'Image hash to lookup configuration for',
              demandOption: true,
            })
          },
          async (argv) => {
            console.log(await doGetConfiguration(argv.endpoint as string, argv.imageHash as string))
          },
        )
        .command(
          'get-deploy <wallet>',
          'Get deploy information for a wallet',
          (yargs) => {
            return yargs.positional('wallet', {
              type: 'string',
              description: 'Wallet address',
              demandOption: true,
            })
          },
          async (argv) => {
            console.log(await doGetDeploy(argv.endpoint as string, argv.wallet as string))
          },
        )
        .command(
          'get-wallets <signer>',
          'Get wallets for a signer',
          (yargs) => {
            return yargs.positional('signer', {
              type: 'string',
              description: 'Signer address',
              demandOption: true,
            })
          },
          async (argv) => {
            console.log(await doGetWallets(argv.endpoint as string, argv.signer as string))
          },
        )
        .command(
          'get-wallets-for-sapient <signer> <imageHash>',
          'Get wallets for a sapient signer',
          (yargs) => {
            return yargs
              .positional('signer', {
                type: 'string',
                description: 'Signer address',
                demandOption: true,
              })
              .positional('imageHash', {
                type: 'string',
                description: 'Image hash',
                demandOption: true,
              })
          },
          async (argv) => {
            console.log(
              await doGetWalletsForSapient(argv.endpoint as string, argv.signer as string, argv.imageHash as string),
            )
          },
        )
        .command(
          'get-witness-for <wallet> <signer>',
          'Get witness for wallet and signer',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('signer', {
                type: 'string',
                description: 'Signer address',
                demandOption: true,
              })
          },
          async (argv) => {
            console.log(await doGetWitnessFor(argv.endpoint as string, argv.wallet as string, argv.signer as string))
          },
        )
        .command(
          'get-witness-for-sapient <wallet> <signer> <imageHash>',
          'Get witness for sapient signer',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('signer', {
                type: 'string',
                description: 'Signer address',
                demandOption: true,
              })
              .positional('imageHash', {
                type: 'string',
                description: 'Image hash',
                demandOption: true,
              })
          },
          async (argv) => {
            console.log(
              await doGetWitnessForSapient(
                argv.endpoint as string,
                argv.wallet as string,
                argv.signer as string,
                argv.imageHash as string,
              ),
            )
          },
        )
        .command(
          'get-configuration-updates <wallet> <fromImageHash>',
          'Get configuration updates for wallet',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('fromImageHash', {
                type: 'string',
                description: 'Starting image hash',
                demandOption: true,
              })
              .option('all-updates', {
                type: 'boolean',
                description: 'Get all updates',
                default: false,
              })
          },
          async (argv) => {
            console.log(
              await doGetConfigurationUpdates(
                argv.endpoint as string,
                argv.wallet as string,
                argv.fromImageHash as string,
                argv.allUpdates,
              ),
            )
          },
        )
        .command(
          'get-tree <rootHash>',
          'Get tree by root hash',
          (yargs) => {
            return yargs.positional('rootHash', {
              type: 'string',
              description: 'Root hash of the tree',
              demandOption: true,
            })
          },
          async (argv) => {
            console.log(await doGetTree(argv.endpoint as string, argv.rootHash as string))
          },
        )
        .command(
          'get-payload <opHash>',
          'Get payload by operation hash',
          (yargs) => {
            return yargs.positional('opHash', {
              type: 'string',
              description: 'Operation hash',
              demandOption: true,
            })
          },
          async (argv) => {
            console.log(await doGetPayload(argv.endpoint as string, argv.opHash as string))
          },
        )
        // Writer commands
        .command(
          'save-wallet <deployConfiguration> <context>',
          'Save wallet with deploy configuration and context',
          (yargs) => {
            return yargs
              .positional('deployConfiguration', {
                type: 'string',
                description: 'Deploy configuration JSON (if not using pipe)',
              })
              .positional('context', {
                type: 'string',
                description: 'Context JSON',
              })
          },
          async (argv) => {
            const deployConfiguration = await fromPosOrStdin(argv, 'deployConfiguration')
            console.log(await doSaveWallet(argv.endpoint as string, deployConfiguration, argv.context as string))
          },
        )
        .command(
          'save-witnesses <wallet> <chainId> <payload> <signatures>',
          'Save witnesses for wallet',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('chainId', {
                type: 'string',
                description: 'Chain ID',
                demandOption: true,
              })
              .positional('payload', {
                type: 'string',
                description: 'Payload JSON (if not using pipe)',
              })
              .positional('signatures', {
                type: 'string',
                description: 'Signatures JSON',
              })
          },
          async (argv) => {
            const payload = await fromPosOrStdin(argv, 'payload')
            console.log(
              await doSaveWitnesses(
                argv.endpoint as string,
                argv.wallet as string,
                argv.chainId as string,
                payload,
                argv.signatures as string,
              ),
            )
          },
        )
        .command(
          'save-update <wallet> <configuration> <signature>',
          'Save update for wallet',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('configuration', {
                type: 'string',
                description: 'Configuration JSON (if not using pipe)',
              })
              .positional('signature', {
                type: 'string',
                description: 'Signature JSON',
              })
          },
          async (argv) => {
            const configuration = await fromPosOrStdin(argv, 'configuration')
            console.log(
              await doSaveUpdate(
                argv.endpoint as string,
                argv.wallet as string,
                configuration,
                argv.signature as string,
              ),
            )
          },
        )
        .command(
          'save-tree [tree]',
          'Save tree',
          (yargs) => {
            return yargs.positional('tree', {
              type: 'string',
              description: 'Tree JSON (if not using pipe)',
            })
          },
          async (argv) => {
            const tree = await fromPosOrStdin(argv, 'tree')
            console.log(await doSaveTree(argv.endpoint as string, tree))
          },
        )
        .command(
          'save-configuration [config]',
          'Save configuration',
          (yargs) => {
            return yargs.positional('config', {
              type: 'string',
              description: 'Configuration JSON (if not using pipe)',
            })
          },
          async (argv) => {
            const config = await fromPosOrStdin(argv, 'config')
            console.log(await doSaveConfiguration(argv.endpoint as string, config))
          },
        )
        .command(
          'save-deploy <imageHash> <context>',
          'Save deploy information',
          (yargs) => {
            return yargs
              .positional('imageHash', {
                type: 'string',
                description: 'Image hash',
                demandOption: true,
              })
              .positional('context', {
                type: 'string',
                description: 'Context JSON (if not using pipe)',
              })
          },
          async (argv) => {
            const context = await fromPosOrStdin(argv, 'context')
            console.log(await doSaveDeploy(argv.endpoint as string, argv.imageHash as string, context))
          },
        )
        .command(
          'save-payload <wallet> <payload> <chainId>',
          'Save payload for wallet',
          (yargs) => {
            return yargs
              .positional('wallet', {
                type: 'string',
                description: 'Wallet address',
                demandOption: true,
              })
              .positional('payload', {
                type: 'string',
                description: 'Payload JSON (if not using pipe)',
              })
              .positional('chainId', {
                type: 'string',
                description: 'Chain ID',
                demandOption: true,
              })
          },
          async (argv) => {
            const payload = await fromPosOrStdin(argv, 'payload')
            console.log(
              await doSavePayload(argv.endpoint as string, argv.wallet as string, payload, argv.chainId as string),
            )
          },
        )
        .demandCommand(1, 'You must specify a subcommand for state')
    )
  },
  handler: () => {},
}

export default stateCommand

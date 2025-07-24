import { AbiParameters, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { Address, Payload } from '@0xsequence/wallet-primitives'
import { fromPosOrStdin } from '../utils.js'

const CallAbi = [
  { type: 'address', name: 'to' },
  { type: 'uint256', name: 'value' },
  { type: 'bytes', name: 'data' },
  { type: 'uint256', name: 'gasLimit' },
  { type: 'bool', name: 'delegateCall' },
  { type: 'bool', name: 'onlyFallback' },
  { type: 'uint256', name: 'behaviorOnError' },
]

export const DecodedAbi = [
  { type: 'uint8', name: 'kind' },
  { type: 'bool', name: 'noChainId' },
  {
    type: 'tuple[]',
    name: 'calls',
    components: CallAbi,
  },
  { type: 'uint256', name: 'space' },
  { type: 'uint256', name: 'nonce' },
  { type: 'bytes', name: 'message' },
  { type: 'bytes32', name: 'imageHash' },
  { type: 'bytes32', name: 'digest' },
  { type: 'address[]', name: 'parentWallets' },
]

export async function doConvertToAbi(_payload: string): Promise<string> {
  // Not implemented yet, but following the pattern
  throw new Error('Not implemented')
}

export async function doConvertToPacked(payload: Hex.Hex, wallet?: Address.Checksummed): Promise<string> {
  const decodedPayload = Payload.fromAbiFormat(
    AbiParameters.decode(
      [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
      payload,
    )[0] as unknown as Payload.SolidityDecoded,
  )

  if (Payload.isCalls(decodedPayload)) {
    const packed = Payload.encode(decodedPayload, wallet)
    return Hex.from(packed)
  }

  throw new Error('Not implemented')
}

export async function doConvertToJson(payload: Hex.Hex): Promise<string> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload,
  )[0] as unknown as Payload.SolidityDecoded

  return JSON.stringify(decoded)
}

export async function doHash(wallet: Address.Checksummed, chainId: bigint, payload: Hex.Hex): Promise<string> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload,
  )[0] as unknown as Payload.SolidityDecoded

  return Hex.from(Payload.hash(wallet, chainId, Payload.fromAbiFormat(decoded)))
}

const payloadCommand: CommandModule = {
  command: 'payload',
  describe: 'Payload conversion utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'to-abi [payload]',
        'Convert payload to ABI format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
          })
        },
        async (argv) => {
          const payload = await fromPosOrStdin(argv, 'payload')
          const result = await doConvertToAbi(payload)
          console.log(result)
        },
      )
      .command(
        'to-packed [payload] [wallet]',
        'Convert payload to packed format',
        (yargs) => {
          return yargs
            .positional('payload', {
              type: 'string',
              description: 'Input payload to convert',
            })
            .positional('wallet', {
              type: 'string',
              description: 'Wallet of the wallet to hash the payload',
              demandOption: false,
            })
        },
        async (argv) => {
          const payload = await fromPosOrStdin(argv, 'payload')
          Hex.assert(payload)
          const result = await doConvertToPacked(payload, argv.wallet ? Address.checksum(argv.wallet) : undefined)
          console.log(result)
        },
      )
      .command(
        'to-json [payload]',
        'Convert payload to JSON format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
          })
        },
        async (argv) => {
          const payload = await fromPosOrStdin(argv, 'payload')
          Hex.assert(payload)
          const result = await doConvertToJson(payload)
          console.log(result)
        },
      )
      .command(
        'hash [payload]',
        'Hash the payload',
        (yargs) => {
          return yargs
            .option('wallet', {
              type: 'string',
              description: 'Wallet of the wallet to hash the payload',
              demandOption: true,
            })
            .option('chainId', {
              type: 'string',
              description: 'Chain ID of the payload',
              demandOption: true,
            })
            .positional('payload', {
              type: 'string',
              description: 'Input payload to hash',
            })
        },
        async (argv) => {
          const payload = await fromPosOrStdin(argv, 'payload')
          Hex.assert(payload)
          const result = await doHash(Address.checksum(argv.wallet), BigInt(argv.chainId), payload)
          console.log(result)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for payload')
  },
  handler: () => {},
}

export default payloadCommand

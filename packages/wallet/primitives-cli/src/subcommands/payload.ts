import { AbiParameters, Address, Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { Payload } from '@0xsequence/wallet-primitives'
import { fromPosOrStdin } from '../utils'

export const KIND_TRANSACTIONS = 0x00
const KIND_MESSAGE = 0x01
const KIND_CONFIG_UPDATE = 0x02
const KIND_DIGEST = 0x03

const BEHAVIOR_IGNORE_ERROR = 0x00
const BEHAVIOR_REVERT_ON_ERROR = 0x01
const BEHAVIOR_ABORT_ON_ERROR = 0x02

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

export interface SolidityDecoded {
  kind: number
  noChainId: boolean
  calls: SolidityCall[]
  space: bigint
  nonce: bigint
  message: string
  imageHash: string
  digest: string
  parentWallets: string[]
}

interface SolidityCall {
  to: string
  value: bigint
  data: string
  gasLimit: bigint
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: bigint
}

function behaviorOnError(behavior: number): 'ignore' | 'revert' | 'abort' {
  switch (behavior) {
    case BEHAVIOR_IGNORE_ERROR:
      return 'ignore'
    case BEHAVIOR_REVERT_ON_ERROR:
      return 'revert'
    case BEHAVIOR_ABORT_ON_ERROR:
      return 'abort'
    default:
      throw new Error(`Unknown behavior: ${behavior}`)
  }
}

export async function doConvertToAbi(_payload: string): Promise<string> {
  // Not implemented yet, but following the pattern
  throw new Error('Not implemented')
}

export function solidityEncodedToParentedPayload(decoded: SolidityDecoded): Payload.Parented {
  if (decoded.kind === KIND_TRANSACTIONS) {
    return {
      type: 'call',
      nonce: decoded.nonce,
      space: decoded.space,
      calls: decoded.calls.map((call) => ({
        to: Address.from(call.to),
        value: call.value,
        data: Bytes.from(call.data as Hex.Hex),
        gasLimit: call.gasLimit,
        delegateCall: call.delegateCall,
        onlyFallback: call.onlyFallback,
        behaviorOnError: behaviorOnError(Number(call.behaviorOnError)),
      })),
      parentWallets: decoded.parentWallets.map((wallet) => Address.from(wallet)),
    }
  }

  if (decoded.kind === KIND_MESSAGE) {
    return {
      type: 'message',
      message: Bytes.fromHex(decoded.message as `0x${string}`),
      parentWallets: decoded.parentWallets.map((wallet) => Address.from(wallet)),
    }
  }

  if (decoded.kind === KIND_CONFIG_UPDATE) {
    return {
      type: 'config-update',
      imageHash: decoded.imageHash as `0x${string}`,
      parentWallets: decoded.parentWallets.map((wallet) => Address.from(wallet)),
    }
  }

  if (decoded.kind === KIND_DIGEST) {
    return {
      type: 'digest',
      digest: decoded.digest as `0x${string}`,
      parentWallets: decoded.parentWallets.map((wallet) => Address.from(wallet)),
    }
  }

  throw new Error('Not implemented')
}

export async function doConvertToPacked(payload: string, wallet?: string): Promise<string> {
  const decodedPayload = solidityEncodedToParentedPayload(
    AbiParameters.decode(
      [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
      payload as Hex.Hex,
    )[0] as unknown as SolidityDecoded,
  )

  if (Payload.isCalls(decodedPayload)) {
    const packed = Payload.encode(decodedPayload, wallet ? (wallet as `0x${string}`) : undefined)
    return Hex.from(packed)
  }

  throw new Error('Not implemented')
}

export async function doConvertToJson(payload: string): Promise<string> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload as Hex.Hex,
  )[0] as unknown as SolidityDecoded

  const json = JSON.stringify(decoded)
  return json
}

export async function doHash(wallet: string, chainId: bigint, payload: string): Promise<string> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload as Hex.Hex,
  )[0] as unknown as SolidityDecoded

  return Hex.from(Payload.hash(Address.from(wallet), chainId, solidityEncodedToParentedPayload(decoded)))
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
          const result = await doConvertToPacked(payload, argv.wallet)
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
          const result = await doHash(argv.wallet, BigInt(argv.chainId), payload)
          console.log(result)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for payload')
  },
  handler: () => {},
}

export default payloadCommand

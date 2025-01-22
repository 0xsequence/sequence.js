import { AbiParameters, Address, Bytes, Hex } from 'ox'
import type { CommandModule } from 'yargs'
import { encode } from '@0xsequence/sequence-primitives'

const KIND_TRANSACTIONS = 0x00
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

const DecodedAbi = [
  { type: 'uint8', name: 'kind' },
  { type: 'bool', name: 'noChainId' },
  {
    type: 'tuple[]',
    name: 'calls',
    components: CallAbi
  },
  { type: 'uint256', name: 'space' },
  { type: 'uint256', name: 'nonce' },
  { type: 'bytes', name: 'message' },
  { type: 'bytes32', name: 'imageHash' },
  { type: 'bytes32', name: 'digest' },
  { type: 'address[]', name: 'parentWallets' },
]

interface SolidityDecoded {
  kind: number;
  noChainId: boolean;
  calls: SolidityCall[];
  space: bigint;
  nonce: bigint;
  message: string;
  imageHash: string;
  digest: string;
  parentWallets: string[];
}

interface SolidityCall {
  to: string;
  value: bigint;
  data: string;
  gasLimit: bigint;
  delegateCall: boolean;
  onlyFallback: boolean;
  behaviorOnError: bigint;
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

async function convertToAbi(_payload: string): Promise<void> {
  throw new Error('Not implemented')
}

async function convertToPacked(payload: string): Promise<void> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload as Hex.Hex
  )[0] as unknown as SolidityDecoded

  if (decoded.kind === KIND_TRANSACTIONS) {
    const packed = encode({
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
    })
    console.log(Hex.from(packed))
    return
  }

  throw new Error('Not implemented')
}

async function convertToHuman(payload: string): Promise<void> {
  const decoded = AbiParameters.decode(
    [{ type: 'tuple', name: 'payload', components: DecodedAbi }],
    payload as Hex.Hex
  )[0] as unknown as SolidityDecoded

  console.log(decoded)
}

const payloadCommand: CommandModule = {
  command: 'payload',
  describe: 'Payload conversion utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'to-abi <payload>',
        'Convert payload to ABI format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
            demandOption: true,
          })
        },
        async (argv) => {
          await convertToAbi(argv.payload)
        },
      )
      .command(
        'to-packed <payload>',
        'Convert payload to packed format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
            demandOption: true,
          })
        },
        async (argv) => {
          await convertToPacked(argv.payload)
        },
      )
      .command(
        'to-human <payload>',
        'Convert payload to human readable format',
        (yargs) => {
          return yargs.positional('payload', {
            type: 'string',
            description: 'Input payload to convert',
            demandOption: true,
          })
        },
        async (argv) => {
          await convertToHuman(argv.payload)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for payload')
  },
  handler: () => {},
}

export default payloadCommand

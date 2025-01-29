import { boolean, type CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils'
import {
  configFromJson,
  encodeSignature,
  fillLeaves,
  isSapientSignerLeaf,
  isSignerLeaf,
} from '@0xsequence/sequence-primitives'
import { PossibleElements } from './config'
import { Bytes, Hex } from 'ox'

const SignatureElements = [
  {
    type: 'eth_sign',
    format: '<address>:eth_sign:<r>:<s>:<v>',
    description: 'An eth_sign signature',
  },
  {
    type: 'hash',
    format: '<address>:hash:<r>:<s>:<v>',
    description: 'A hash signature',
  },
  {
    type: 'erc1271',
    format: '<address>:erc1271:<data>',
    description: 'An erc1271 signature',
  },
  {
    type: 'sapient',
    format: '<address>:sapient:<data>',
    description: 'A sapient signature',
  },
  {
    type: 'sapient_compact',
    format: '<address>:sapient_compact:<data>',
    description: 'A sapient compact signature',
  },
]

async function doEncode(input: string, signatures: string[] = [], noChainId: boolean): Promise<void> {
  const config = configFromJson(input)

  const allSignatures = signatures.map((s) => {
    const values = s.split(':')
    return {
      address: values[0],
      type: values[1],
      values: values.slice(2),
    }
  })

  const fullTopology = fillLeaves(config.topology, (leaf) => {
    if (isSignerLeaf(leaf)) {
      // Type must be 1271, eth_sign, or hash
      const candidate = allSignatures.find((s) => s.address === leaf.address)

      if (!candidate) {
        return undefined
      }

      if (candidate.type === 'erc1271') {
        return {
          address: candidate.address as `0x${string}`,
          data: Bytes.fromHex(candidate.values[0] as `0x${string}`),
          type: 'erc1271',
        }
      }

      if (candidate.type === 'eth_sign') {
        return {
          r: Bytes.padLeft(Bytes.fromHex(candidate.values[0] as `0x${string}`), 32),
          s: Bytes.padLeft(Bytes.fromHex(candidate.values[1] as `0x${string}`), 32),
          v: Number(candidate.values[2]),
          type: 'eth_sign',
        }
      }

      if (candidate.type === 'hash') {
        return {
          r: Bytes.padLeft(Bytes.fromHex(candidate.values[0] as `0x${string}`), 32),
          s: Bytes.padLeft(Bytes.fromHex(candidate.values[1] as `0x${string}`), 32),
          v: Number(candidate.values[2]),
          type: 'hash',
        }
      }

      if (candidate.type === 'sapient' || candidate.type === 'sapient_compact') {
        throw new Error(`Incorrect type for leaf: ${leaf.type}`)
      }

      throw new Error(`Unsupported signature type: ${candidate.type}`)
    }

    if (isSapientSignerLeaf(leaf)) {
      const candidate = allSignatures.find((s) => s.address === leaf.address)
      if (!candidate) {
        return undefined
      }

      if (candidate.type === 'sapient' || candidate.type === 'sapient_compact') {
        return {
          address: candidate.address as `0x${string}`,
          data: Bytes.fromHex(candidate.values[0] as `0x${string}`),
          type: candidate.type,
        }
      }

      if (candidate.type === 'eth_sign' || candidate.type === 'hash' || candidate.type === 'erc1271') {
        throw new Error(`Incorrect type for leaf: ${leaf.type}`)
      }

      throw new Error(`Unsupported signature type: ${candidate.type}`)
    }

    return undefined
  })

  const encoded = encodeSignature(
    {
      ...config,
      topology: fullTopology,
    },
    {
      noChainId,
    },
  )

  console.log(Hex.fromBytes(encoded))
}

const signatureCommand: CommandModule = {
  command: 'signature',
  describe: 'Signature utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'encode [input]',
        'Encode signature from hex input',
        (yargs) => {
          return yargs
            .option('signature', {
              type: 'string',
              array: true,
              description:
                'A signature to include in the encoded signature, one of:\n' +
                PossibleElements.map((e) => `- ${e.format}`).join('\n'),
              demandOption: false,
              alias: 's',
            })
            .option('chain-id', {
              type: 'boolean',
              description: 'Use chainId of recovered chain on signature',
              demandOption: false,
              default: true,
            })
            .positional('input', {
              type: 'string',
              description: 'Hex input to encode (if not using pipe)',
            })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          await doEncode(input, argv.signature, !argv.chainId)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for signature')
  },
  handler: () => {},
}

export default signatureCommand

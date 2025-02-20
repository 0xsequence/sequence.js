import type { CommandModule } from 'yargs'
import {
  Configuration,
  configToJson,
  configFromJson,
  encodeSignature,
  hashConfiguration,
  Leaf,
  flatLeavesToTopology,
} from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex } from 'ox'
import { fromPosOrStdin } from '../utils'

export const PossibleElements = [
  {
    type: 'signer',
    format: 'signer:<address>:<weight>',
    description: 'A signer leaf',
  },
  {
    type: 'subdigest',
    format: 'subdigest:<subdigest>',
    description: 'A subdigest leaf',
  },
  {
    type: 'sapient',
    format: 'sapient:<image_hash>:<address>:<weight>',
    description: 'A sapient leaf',
  },
  {
    type: 'nested',
    format: 'nested:<threshold>:<weight>:(<elements>)',
    description: 'A nested leaf',
  },
  {
    type: 'node',
    format: 'node:<hash>',
    description: 'A node leaf',
  },
  {
    type: 'any-address-subdigest',
    format: 'any-address-subdigest:<digest>',
    description: 'An any address subdigest leaf',
  },
]

function parseElements(elements: string): Leaf[] {
  const leaves: Leaf[] = []
  let remainingElements = elements

  // Split by space and get first element
  while (remainingElements.length > 0) {
    const firstElement = remainingElements.split(' ')[0]
    const firstElementType = firstElement!.split(':')[0]
    if (firstElementType === 'signer') {
      const [_, address, weight] = firstElement!.split(':')
      leaves.push({
        type: 'signer',
        address: Address.from(address!),
        weight: BigInt(weight!),
      })
      remainingElements = remainingElements.slice(firstElement!.length + 1)
    } else if (firstElementType === 'subdigest') {
      const [_, digest] = firstElement!.split(':')
      leaves.push({
        type: 'subdigest',
        digest: Bytes.fromHex(digest as `0x${string}`),
      })
      remainingElements = remainingElements.slice(firstElement!.length + 1)
    } else if (firstElementType === 'any-address-subdigest') {
      const [_, digest] = firstElement!.split(':')
      leaves.push({
        type: 'any-address-subdigest',
        digest: Bytes.fromHex(digest as `0x${string}`),
      })
      remainingElements = remainingElements.slice(firstElement!.length + 1)
    } else if (firstElementType === 'sapient') {
      const [_, imageHash, address, weight] = firstElement!.split(':')
      leaves.push({
        type: 'sapient-signer',
        imageHash: Bytes.fromHex(imageHash as `0x${string}`),
        address: Address.from(address!),
        weight: BigInt(weight!),
      })
      remainingElements = remainingElements.slice(firstElement!.length + 1)
    } else if (firstElementType === 'nested') {
      // This is a bit spacial
      // as we need to grab all nested elements within ( )
      const [_, threshold, weight] = firstElement!.split(':')
      const startSubElements = remainingElements.indexOf('(')
      const endSubElements = remainingElements.indexOf(')')
      if (startSubElements === -1 || endSubElements === -1) {
        throw new Error(`Missing ( ) for nested element: ${remainingElements}`)
      }
      const innerSubElements = remainingElements.slice(startSubElements + 1, endSubElements)
      leaves.push({
        type: 'nested',
        threshold: BigInt(threshold!),
        weight: BigInt(weight!),
        tree: flatLeavesToTopology(parseElements(innerSubElements)),
      })
      remainingElements = remainingElements.slice(endSubElements + 1).trim()
    } else if (firstElementType === 'node') {
      const [_, hash] = firstElement!.split(':')
      leaves.push(Bytes.fromHex(hash as `0x${string}`))
      remainingElements = remainingElements.slice(firstElement!.length + 1)
    } else {
      throw new Error(`Invalid element: ${firstElement}`)
    }
  }

  return leaves
}

export async function createConfig(options: {
  threshold: string
  checkpoint: string
  from: string
  content: string[]
}): Promise<string> {
  const leaves = parseElements(options.content.join(' '))
  const config: Configuration = {
    threshold: BigInt(options.threshold),
    checkpoint: BigInt(options.checkpoint),
    // Starts with empty topology
    topology: flatLeavesToTopology(leaves),
    checkpointer: undefined,
  }

  return configToJson(config)
}

export async function calculateImageHash(input: string): Promise<string> {
  const config = configFromJson(input)
  return Hex.fromBytes(hashConfiguration(config))
}

export async function doEncode(input: string): Promise<string> {
  const configuration = configFromJson(input)
  return Hex.fromBytes(encodeSignature({ noChainId: true, configuration }))
}

const configCommand: CommandModule = {
  command: 'config',
  describe: 'Configuration utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'new [content...]',
        'Create a new configuration',
        (yargs) => {
          return yargs
            .option('threshold', {
              type: 'string',
              description: 'Threshold value for the configuration',
              demandOption: true,
              alias: 't',
            })
            .option('checkpoint', {
              type: 'string',
              description: 'Checkpoint value for the configuration',
              demandOption: true,
              alias: 'c',
            })
            .option('from', {
              type: 'string',
              description: 'The process to use to create the configuration',
              demandOption: false,
              default: 'flat',
              choices: ['flat'],
              alias: 'f',
            })
            .positional('content', {
              type: 'string',
              array: true,
              description:
                'The elements to use to create the configuration:\n' +
                PossibleElements.map((e) => `- ${e.format}`).join('\n'),
              demandOption: true,
            })
        },
        async (argv) => {
          console.log(await createConfig(argv))
        },
      )
      .command(
        'image-hash [input]',
        'Calculate image hash from hex input',
        (yargs) => {
          return yargs.positional('input', {
            type: 'string',
            description: 'Hex input to hash (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          console.log(await calculateImageHash(input))
        },
      )
      .command(
        'encode [input]',
        'Encode configuration from hex input',
        (yargs) => {
          return yargs.positional('input', {
            type: 'string',
            description: 'Hex input to encode (if not using pipe)',
          })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          console.log(await doEncode(input))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for config')
  },
  handler: () => {},
}

export default configCommand

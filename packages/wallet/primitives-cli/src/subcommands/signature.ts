import { Config, Signature } from '@0xsequence/wallet-primitives'
import { Bytes, Hex, Signature as OxSignature } from 'ox'
import { type CommandModule } from 'yargs'
import { fromPosOrStdin } from '../utils.js'
import { PossibleElements } from './config.js'

// const SignatureElements = [
//   {
//     type: 'eth_sign',
//     format: '<address>:eth_sign:<r>:<s>:<v>',
//     description: 'An eth_sign signature',
//   },
//   {
//     type: 'hash',
//     format: '<address>:hash:<r>:<s>:<v>',
//     description: 'A hash signature',
//   },
//   {
//     type: 'erc1271',
//     format: '<address>:erc1271:<data>',
//     description: 'An erc1271 signature',
//   },
//   {
//     type: 'sapient',
//     format: '<address>:sapient:<data>',
//     description: 'A sapient signature',
//   },
//   {
//     type: 'sapient_compact',
//     format: '<address>:sapient_compact:<data>',
//     description: 'A sapient compact signature',
//   },
// ]

export async function doEncode(
  input: string,
  signatures: string[] = [],
  noChainId: boolean,
  checkpointerData?: Hex.Hex,
): Promise<string> {
  const config = Config.configFromJson(input)

  const allSignatures = signatures.filter(Boolean).map((s) => {
    const values = s.split(':')
    if (values[0] === undefined) {
      throw new Error('no address for signature')
    }
    Address.assert(values[0])
    return {
      address: values[0],
      type: values[1],
      values: values.slice(2),
    }
  })

  const fullTopology = Signature.fillLeaves(config.topology, (leaf) => {
    if (Config.isSignerLeaf(leaf)) {
      // Type must be 1271, eth_sign, or hash
      const candidate = allSignatures.find((s) => Address.isEqual(s.address, leaf.address))

      if (!candidate) {
        return undefined
      }

      if (candidate.type === 'erc1271') {
        Hex.assert(candidate.values[0])
        return {
          address: candidate.address,
          data: candidate.values[0],
          type: 'erc1271',
        }
      }

      if (candidate.type === 'eth_sign') {
        Hex.assert(candidate.values[0])
        Hex.assert(candidate.values[1])
        return {
          r: Bytes.toBigInt(Bytes.fromHex(candidate.values[0], { size: 32 })),
          s: Bytes.toBigInt(Bytes.fromHex(candidate.values[1], { size: 32 })),
          yParity: OxSignature.vToYParity(Number(candidate.values[2])),
          type: 'eth_sign',
        }
      }

      if (candidate.type === 'hash') {
        Hex.assert(candidate.values[0])
        Hex.assert(candidate.values[1])
        return {
          r: Bytes.toBigInt(Bytes.fromHex(candidate.values[0], { size: 32 })),
          s: Bytes.toBigInt(Bytes.fromHex(candidate.values[1], { size: 32 })),
          yParity: OxSignature.vToYParity(Number(candidate.values[2])),
          type: 'hash',
        }
      }

      if (candidate.type === 'sapient' || candidate.type === 'sapient_compact') {
        throw new Error(`Incorrect type for leaf: ${leaf.type}`)
      }

      throw new Error(`Unsupported signature type: ${candidate.type}`)
    }

    if (Config.isSapientSignerLeaf(leaf)) {
      const candidate = allSignatures.find((s) => Address.isEqual(s.address, leaf.address))
      if (!candidate) {
        return undefined
      }

      if (candidate.type === 'sapient' || candidate.type === 'sapient_compact') {
        Hex.assert(candidate.values[0])
        return {
          address: candidate.address,
          data: candidate.values[0],
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

  const encoded = Signature.encodeSignature({
    noChainId,
    configuration: { ...config, topology: fullTopology },
    checkpointerData: checkpointerData ? Bytes.fromHex(checkpointerData) : undefined,
  })

  return Hex.fromBytes(encoded)
}

export async function doConcat(signatures: Hex.Hex[]): Promise<string> {
  if (signatures.length === 0) {
    throw new Error('No signatures provided')
  }

  const decoded = signatures.map((s) => Signature.decodeSignature(Bytes.fromHex(s)))

  const reEncoded = Signature.encodeSignature({
    ...decoded[0]!,
    suffix: decoded.slice(1),
  })

  return Hex.fromBytes(reEncoded)
}

export async function doDecode(signature: Hex.Hex): Promise<string> {
  const bytes = Bytes.fromHex(signature)
  const decoded = Signature.decodeSignature(bytes)
  return Signature.rawSignatureToJson(decoded)
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
            .option('checkpointer-data', {
              type: 'string',
              description: 'Checkpointer data in hex format',
              demandOption: false,
            })
            .positional('input', {
              type: 'string',
              description: 'Hex input to encode (if not using pipe)',
            })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'input')
          Hex.assert(argv.checkpointerData)
          console.log(await doEncode(input, argv.signature, !argv.chainId, argv.checkpointerData))
        },
      )
      .command(
        'concat [signatures...]',
        'Concatenate multiple signatures',
        (yargs) => {
          return yargs.positional('signatures', {
            type: 'string',
            array: true,
            description: 'Hex signatures to concatenate',
            demandOption: true,
          })
        },
        async (argv) => {
          console.log(
            await doConcat(
              argv.signatures.map((signature) => {
                Hex.assert(signature)
                return signature
              }),
            ),
          )
        },
      )
      .command(
        'decode [signature]',
        'Decode a signature from bytes',
        (yargs) => {
          return yargs.positional('signature', {
            type: 'string',
            description: 'Hex signature to decode',
            demandOption: true,
          })
        },
        async (argv) => {
          const input = await fromPosOrStdin(argv, 'signature')
          Hex.assert(input)
          console.log(await doDecode(input))
        },
      )
      .demandCommand(1, 'You must specify a subcommand for signature')
  },
  handler: () => {},
}

export default signatureCommand

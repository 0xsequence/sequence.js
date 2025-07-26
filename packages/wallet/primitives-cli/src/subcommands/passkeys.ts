// ./packages/wallet/primitives-cli/src/subcommands/passkeys.ts

import type { CommandModule } from 'yargs'
import { Bytes, Hex } from 'ox'
import { fromPosOrStdin } from '../utils.js'
import { Extensions } from '@0xsequence/wallet-primitives'

// Reusable function for encoding a signature
export async function doEncodeSignature(options: {
  x: Hex.Hex
  y: Hex.Hex
  requireUserVerification: boolean
  credentialId?: string
  metadataHash?: Hex.Hex
  r: Hex.Hex
  s: Hex.Hex
  authenticatorData: Hex.Hex
  clientDataJson: string | object
  embedMetadata: boolean
}): Promise<string> {
  if (options.credentialId && options.metadataHash) {
    throw new Error('Cannot provide both credential-id and metadata-hash')
  }
  if (options.embedMetadata && !options.credentialId && !options.metadataHash) {
    throw new Error('Metadata (credential-id or metadata-hash) is required when embed-metadata is true')
  }

  const publicKey: Extensions.Passkeys.PublicKey = {
    x: options.x,
    y: options.y,
    requireUserVerification: options.requireUserVerification,
    metadata: options.credentialId ? { credentialId: options.credentialId } : options.metadataHash,
  }

  const decodedSignature: Extensions.Passkeys.DecodedSignature = {
    publicKey,
    r: Bytes.fromHex(options.r),
    s: Bytes.fromHex(options.s),
    authenticatorData: Bytes.fromHex(options.authenticatorData),
    clientDataJSON:
      typeof options.clientDataJson === 'string' ? options.clientDataJson : JSON.stringify(options.clientDataJson),
    embedMetadata: options.embedMetadata,
  }

  const encoded = Extensions.Passkeys.encode(decodedSignature)
  return Bytes.toHex(encoded)
}

// Reusable function for decoding a signature
export async function doDecodeSignature(encodedSignature: Hex.Hex): Promise<string> {
  const encodedBytes = Bytes.fromHex(encodedSignature)
  const decoded = Extensions.Passkeys.decode(encodedBytes)

  // Convert bytes back to hex for readability in JSON output
  const jsonFriendlyDecoded = {
    ...decoded,
    publicKey: {
      ...decoded.publicKey,
      metadata:
        typeof decoded.publicKey.metadata === 'string'
          ? decoded.publicKey.metadata // Keep hex hash as is
          : decoded.publicKey.metadata, // Keep credentialId object as is
    },
    r: Bytes.toHex(decoded.r),
    s: Bytes.toHex(decoded.s),
    authenticatorData: Bytes.toHex(decoded.authenticatorData),
  }

  return JSON.stringify(jsonFriendlyDecoded, null, 2)
}

// Reusable function for computing the root
export async function doComputeRoot(options: {
  x: Hex.Hex
  y: Hex.Hex
  requireUserVerification: boolean
  credentialId?: string
  metadataHash?: Hex.Hex
}): Promise<string> {
  if (options.credentialId && options.metadataHash) {
    throw new Error('Cannot provide both credential-id and metadata-hash')
  }

  const publicKey: Extensions.Passkeys.PublicKey = {
    x: options.x,
    y: options.y,
    requireUserVerification: options.requireUserVerification,
    metadata: options.credentialId ? { credentialId: options.credentialId } : options.metadataHash,
  }

  const root = Extensions.Passkeys.rootFor(publicKey)
  return root
}

// Reusable function for validating a signature
export async function doValidateSignature(options: {
  challenge: Hex.Hex
  x: Hex.Hex
  y: Hex.Hex
  requireUserVerification: boolean
  credentialId?: string
  metadataHash?: Hex.Hex
  r: Hex.Hex
  s: Hex.Hex
  authenticatorData: Hex.Hex
  clientDataJson: string
}): Promise<boolean> {
  if (options.credentialId && options.metadataHash) {
    throw new Error('Cannot provide both credential-id and metadata-hash')
  }

  const publicKey: Extensions.Passkeys.PublicKey = {
    x: options.x,
    y: options.y,
    requireUserVerification: options.requireUserVerification,
    metadata: options.credentialId ? { credentialId: options.credentialId } : options.metadataHash,
  }

  // Construct DecodedSignature without embedMetadata flag, as validation doesn't need it directly
  const decodedSignature: Omit<Extensions.Passkeys.DecodedSignature, 'embedMetadata'> = {
    publicKey,
    r: Bytes.fromHex(options.r),
    s: Bytes.fromHex(options.s),
    authenticatorData: Bytes.fromHex(options.authenticatorData),
    clientDataJSON: options.clientDataJson,
  }

  return Extensions.Passkeys.isValidSignature(options.challenge, decodedSignature)
}

const passkeysCommand: CommandModule = {
  command: 'passkeys',
  describe: 'Passkeys extension utilities',
  builder: (yargs) => {
    return yargs
      .command(
        'encode-signature',
        'Encode a passkey signature',
        (yargs) => {
          return yargs
            .option('x', { type: 'string', description: 'Public key X coordinate (hex)', demandOption: true })
            .option('y', { type: 'string', description: 'Public key Y coordinate (hex)', demandOption: true })
            .option('require-user-verification', {
              type: 'boolean',
              description: 'Flag if UV is required',
              default: false,
            })
            .option('credential-id', { type: 'string', description: 'Credential ID (string, for metadata)' })
            .option('metadata-hash', {
              type: 'string',
              description: 'Metadata hash (hex, alternative to credential-id)',
            })
            .option('r', { type: 'string', description: 'Signature R component (hex)', demandOption: true })
            .option('s', { type: 'string', description: 'Signature S component (hex)', demandOption: true })
            .option('authenticator-data', {
              type: 'string',
              description: 'Authenticator data (hex)',
              demandOption: true,
            })
            .option('client-data-json', {
              type: 'string',
              description: 'Client data JSON (string)',
              demandOption: true,
            })
            .option('embed-metadata', {
              type: 'boolean',
              description: 'Flag to embed metadata hash in the encoded signature',
              default: false,
            })
            .conflicts('credential-id', 'metadata-hash')
        },
        async (argv) => {
          Hex.assert(argv.x)
          Hex.assert(argv.y)
          Hex.assert(argv.metadataHash)
          Hex.assert(argv.r)
          Hex.assert(argv.s)
          Hex.assert(argv.authenticatorData)

          const result = await doEncodeSignature({
            x: argv.x,
            y: argv.y,
            requireUserVerification: argv.requireUserVerification,
            credentialId: argv.credentialId,
            metadataHash: argv.metadataHash,
            r: argv.r,
            s: argv.s,
            authenticatorData: argv.authenticatorData,
            clientDataJson: argv.clientDataJson,
            embedMetadata: argv.embedMetadata,
          })
          console.log(result)
        },
      )
      .command(
        'decode-signature [encoded-signature]',
        'Decode an encoded passkey signature',
        (yargs) => {
          return yargs.positional('encoded-signature', {
            type: 'string',
            description: 'Encoded signature in hex format (or read from stdin)',
          })
        },
        async (argv) => {
          const encodedSignature = await fromPosOrStdin(argv, 'encoded-signature')
          Hex.assert(encodedSignature)

          const result = await doDecodeSignature(encodedSignature)
          console.log(result)
        },
      )
      .command(
        'root',
        'Compute the root hash of a passkey public key tree',
        (yargs) => {
          return yargs
            .option('x', { type: 'string', description: 'Public key X coordinate (hex)', demandOption: true })
            .option('y', { type: 'string', description: 'Public key Y coordinate (hex)', demandOption: true })
            .option('require-user-verification', {
              type: 'boolean',
              description: 'Flag if UV is required',
              default: false,
            })
            .option('credential-id', { type: 'string', description: 'Credential ID (string, for metadata)' })
            .option('metadata-hash', {
              type: 'string',
              description: 'Metadata hash (hex, alternative to credential-id)',
            })
            .conflicts('credential-id', 'metadata-hash')
        },
        async (argv) => {
          Hex.assert(argv.x)
          Hex.assert(argv.y)
          Hex.assert(argv.metadataHash)

          const result = await doComputeRoot({
            x: argv.x,
            y: argv.y,
            requireUserVerification: argv.requireUserVerification,
            credentialId: argv.credentialId,
            metadataHash: argv.metadataHash,
          })
          console.log(result)
        },
      )
      .command(
        'validate-signature',
        'Validate a passkey signature',
        (yargs) => {
          return yargs
            .option('challenge', { type: 'string', description: 'Original challenge (hex)', demandOption: true })
            .option('x', { type: 'string', description: 'Public key X coordinate (hex)', demandOption: true })
            .option('y', { type: 'string', description: 'Public key Y coordinate (hex)', demandOption: true })
            .option('require-user-verification', {
              type: 'boolean',
              description: 'Flag if UV is required',
              default: false,
            })
            .option('credential-id', { type: 'string', description: 'Credential ID (string, for metadata)' })
            .option('metadata-hash', {
              type: 'string',
              description: 'Metadata hash (hex, alternative to credential-id)',
            })
            .option('r', { type: 'string', description: 'Signature R component (hex)', demandOption: true })
            .option('s', { type: 'string', description: 'Signature S component (hex)', demandOption: true })
            .option('authenticator-data', {
              type: 'string',
              description: 'Authenticator data (hex)',
              demandOption: true,
            })
            .option('client-data-json', {
              type: 'string',
              description: 'Client data JSON (string)',
              demandOption: true,
            })
            .conflicts('credential-id', 'metadata-hash')
        },
        async (argv) => {
          Hex.assert(argv.challenge)
          Hex.assert(argv.x)
          Hex.assert(argv.y)
          Hex.assert(argv.metadataHash)
          Hex.assert(argv.r)
          Hex.assert(argv.s)
          Hex.assert(argv.authenticatorData)

          const isValid = await doValidateSignature({
            challenge: argv.challenge,
            x: argv.x,
            y: argv.y,
            requireUserVerification: argv.requireUserVerification,
            credentialId: argv.credentialId,
            metadataHash: argv.metadataHash,
            r: argv.r,
            s: argv.s,
            authenticatorData: argv.authenticatorData,
            clientDataJson: argv.clientDataJson,
          })
          console.log(isValid)
        },
      )
      .demandCommand(1, 'You must specify a subcommand for passkeys')
  },
  handler: () => {},
}

export default passkeysCommand

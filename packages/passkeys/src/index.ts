import { Status, signers } from '@0xsequence/signhub'
import { commons } from '@0xsequence/core'
import { subDigestOf } from '@0xsequence/utils'
import { AbiCoder, ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'

export type PasskeySignerOptions = {
  context: PasskeySignerContext

  id: string

  x: string
  y: string

  chainId: ethers.BigNumberish

  requireUserValidation: boolean
  requireBackupSanityCheck: boolean

  doSign: (
    digest: ethers.BytesLike,
    subdigest: string
  ) => Promise<{
    r: Uint8Array
    s: Uint8Array

    authenticatorData: Uint8Array
    clientDataJSON: string
  }>
}

export type PasskeySignerContext = {
  factory: string

  mainModulePasskeys: string
  guestModule: string
}

function bytesToBase64URL(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class SequencePasskeySigner implements signers.SapientSigner {
  public readonly id: string
  public readonly x: string
  public readonly y: string
  public readonly requireUserValidation: boolean
  public readonly requireBackupSanityCheck: boolean
  public readonly chainId: ethers.BigNumberish

  public readonly context: PasskeySignerContext

  private readonly doSign: (
    digest: ethers.BytesLike,
    subdigest: string
  ) => Promise<{
    r: Uint8Array
    s: Uint8Array
    authenticatorData: Uint8Array
    clientDataJSON: string
  }>

  constructor(options: PasskeySignerOptions) {
    this.id = options.id
    this.x = options.x
    this.y = options.y
    this.requireUserValidation = options.requireUserValidation
    this.requireBackupSanityCheck = options.requireBackupSanityCheck
    this.chainId = options.chainId
    this.context = options.context
    this.doSign = options.doSign
  }

  initCodeHash(): string {
    return ethers.keccak256(
      ethers.getBytes(
        `0x602c3d8160093d39f33d3d3d3d363d3d37363d73${this.context.mainModulePasskeys.replace('0x', '').toLowerCase()}5af43d3d93803e602a57fd5bf3`
      )
    )
  }

  imageHash(): string {
    return ethers.keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint256', 'uint256', 'bool', 'bool'],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes('WebAuthn(uint256 x, uint256 y, bool requireUserValidation, bool requireBackupSanityCheck)')
          ),
          this.x,
          this.y,
          this.requireUserValidation,
          this.requireBackupSanityCheck
        ]
      )
    )
  }

  async getAddress(): Promise<string> {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', this.context.factory, this.imageHash(), this.initCodeHash()]
      )
    )

    return ethers.getAddress(ethers.dataSlice(hash, 12))
  }

  notifyStatusChange(_id: string, _status: Status, _metadata: object): void {}

  async buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    const factoryInterface = new ethers.Interface(walletContracts.eternalFactory.abi)
    const imageHash = this.imageHash()

    const deployEternalFunc = factoryInterface.getFunction('deployEternal')

    if (!deployEternalFunc) {
      throw new Error('Could not find function deployEternal in factory interface')
    }

    return {
      entrypoint: this.context.guestModule,
      transactions: [
        {
          to: this.context.factory,
          data: factoryInterface.encodeFunctionData(deployEternalFunc, [this.context.mainModulePasskeys, imageHash]),
          gasLimit: 100000,
          delegateCall: false,
          revertOnError: true,
          value: 0
        }
      ]
    }
  }

  predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    return Promise.resolve([])
  }

  decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    _metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    return Promise.resolve(bundle)
  }

  async sign(digest: ethers.BytesLike, _metadata: object): Promise<ethers.BytesLike> {
    const subdigest = subDigestOf(await this.getAddress(), this.chainId, digest)

    const signature = await this.doSign(digest, subdigest)

    // Find the index for challengeLocation and responseTypeLocation
    // challengeLocation is the subdigest encoded in Base64URL
    const challenge = '"challenge":"' + bytesToBase64URL(ethers.getBytes(subdigest)) + '"'

    // Find the index for challengeLocation
    const challengeLocation = signature.clientDataJSON.indexOf(challenge)
    if (challengeLocation === -1) {
      throw new Error('Could not find challengeLocation in clientDataJSON')
    }

    // Find the index for responseTypeLocation
    const responseTypeLocation = signature.clientDataJSON.indexOf('"type":"webauthn.get"')
    if (responseTypeLocation === -1) {
      throw new Error('Could not find responseTypeLocation in clientDataJSON')
    }

    // (Sanity check) both values should fit in 4 bytes
    if (challengeLocation > 0xffff || responseTypeLocation > 0xffff) {
      throw new Error('challengeLocation or responseTypeLocation is too large')
    }

    // Pack the flags as hex string for encoding
    const flags = `0x${
      (this.requireUserValidation ? 0x40 : 0) |
      (BigInt(this.chainId) === 0n ? 0x20 : 0) |
      (this.requireBackupSanityCheck ? 0x10 : 0)
    }`

    // Build signature
    const signatureBytes = ethers.solidityPacked(
      ['bytes1', 'uint16', 'bytes', 'uint16', 'string', 'uint16', 'uint16', 'uint256', 'uint256', 'uint256', 'uint256'],
      [
        flags,
        signature.authenticatorData.length,
        signature.authenticatorData,
        signature.clientDataJSON.length,
        signature.clientDataJSON,
        challengeLocation,
        responseTypeLocation,
        signature.r,
        signature.s,
        BigInt(this.x),
        BigInt(this.y)
      ]
    )

    return signatureBytes
  }

  suffix(): ethers.BytesLike {
    return new Uint8Array([3])
  }
}

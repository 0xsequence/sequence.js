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
  provider?: ethers.Provider
  reader?: commons.reader.Reader

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

export type PasskeySignMetadata = {
  cantValidateBehavior: 'ignore' | 'eip6492' | 'throw'
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

  public readonly provider?: ethers.Provider
  private _reader?: commons.reader.Reader

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
    this.provider = options.provider
    this.doSign = options.doSign

    this._reader = options.reader
  }

  reader(): commons.reader.Reader {
    if (this._reader) return this._reader
    if (!this.provider) throw new Error('call requires a provider')
    return new commons.reader.OnChainReader(this.provider)
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

  async isDeployed(): Promise<boolean> {
    return this.reader().isDeployed(await this.getAddress())
  }

  async buildDeployTransaction(
    metadata?: commons.WalletDeployMetadata
  ): Promise<commons.transaction.TransactionBundle | undefined> {
    if (metadata?.ignoreDeployed && (await this.isDeployed())) {
      return
    }

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

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata?: commons.WalletDeployMetadata
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    // Add deploy transaction
    const deployTx = await this.buildDeployTransaction(metadata)
    if (deployTx) {
      bundle.transactions.unshift(...deployTx.transactions)
    }

    return Promise.resolve(bundle)
  }

  async sign(digest: ethers.BytesLike, metadata: PasskeySignMetadata): Promise<ethers.BytesLike> {
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
    const flags = `0x${(
      (this.requireUserValidation ? 0x40 : 0) |
      (BigInt(this.chainId) === 0n ? 0x20 : 0) |
      (this.requireBackupSanityCheck ? 0x10 : 0)
    ).toString(16)}`

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
        ethers.toBigInt(signature.r),
        ethers.toBigInt(signature.s),
        BigInt(this.x),
        BigInt(this.y)
      ]
    )

    if (!!metadata && metadata.cantValidateBehavior !== 'ignore') {
      let isDeployed = false
      try {
        isDeployed = await this.isDeployed()
      } catch (e) {
        // Ignore. Handled below
      }
      if (!isDeployed && metadata.cantValidateBehavior === 'eip6492') {
        return this.buildEIP6492Signature(signatureBytes)
      } else if (!isDeployed && metadata.cantValidateBehavior === 'throw') {
        throw new Error('Cannot sign with a non-deployed passkey signer')
      }
    }

    return signatureBytes
  }

  private async buildEIP6492Signature(signature: string): Promise<string> {
    const deployTransactions = await this.buildDeployTransaction()
    if (!deployTransactions || deployTransactions?.transactions.length === 0) {
      throw new Error('Cannot build EIP-6492 signature without deploy transaction')
    }

    const deployTransaction = deployTransactions.transactions[0]

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes', 'bytes'],
      [deployTransaction.to, deployTransaction.data, signature]
    )

    return ethers.solidityPacked(['bytes', 'bytes32'], [encoded, commons.EIP6492.EIP_6492_SUFFIX])
  }

  suffix(): ethers.BytesLike {
    return new Uint8Array([3])
  }
}

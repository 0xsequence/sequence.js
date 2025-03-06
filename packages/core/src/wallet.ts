import { AbiFunction, Address, Bytes, Hex, PersonalMessage, Provider, Secp256k1 } from 'ox'
import * as State from './state'
import {
  Constants,
  Context,
  Config,
  Address as SequenceAddress,
  Erc6492,
  Payload,
  Signature as SequenceSignature,
} from '@0xsequence/sequence-primitives'
import { SapientSigner, Signer } from './signers'

export type WalletOptions = {
  context: Context.Context
  stateProvider: State.Provider
  onSignerError?: Config.SignerErrorCallback
  guest: Address.Address
}

export const DefaultWalletOptions: WalletOptions = {
  context: Context.Dev1,
  stateProvider: new State.Local.Provider(),
  guest: Constants.DefaultGuest,
}

export type WalletStatus = {
  address: Address.Address
  isDeployed: boolean
  implementation?: Address.Address
  stage?: 'stage1' | 'stage2'
  configuration: Config.Config
  imageHash: Hex.Hex
  /** Pending updates in reverse chronological order (newest first) */
  pendingUpdates: Array<{ imageHash: Hex.Hex; signature: SequenceSignature.RawSignature }>
  chainId?: bigint
}

export class Wallet {
  private readonly signers = new Map<Address.Address, { signer: Signer; isTrusted: boolean }>()
  private readonly sapientSigners = new Map<string, { signer: SapientSigner; isTrusted: boolean }>()
  private readonly options: WalletOptions & { stateProvider: State.Provider }

  constructor(
    readonly address: Address.Address,
    options?: Partial<WalletOptions>,
  ) {
    this.options = { ...DefaultWalletOptions, ...options }
  }

  static async fromConfiguration(configuration: Config.Config, options?: Partial<WalletOptions>): Promise<Wallet> {
    const merged = { ...DefaultWalletOptions, ...options }
    await merged.stateProvider.saveWallet(configuration, merged.context)
    return new Wallet(SequenceAddress.from(configuration, merged.context), merged)
  }

  async setSigner(signer: Signer, isTrusted = false) {
    this.signers.set(await signer.address, { signer, isTrusted })
  }

  async setSapientSigner(signer: SapientSigner, isTrusted = false) {
    this.sapientSigners.set(this.getSapientKey(await signer.address, await signer.imageHash), { signer, isTrusted })
  }

  private getSapientKey(address: Address.Address, imageHash?: Hex.Hex): string {
    return `${address}:${imageHash ?? 'any'}`
  }

  removeSigner(address: Address.Address) {
    this.signers.delete(address)
  }

  removeSapientSigner(address: Address.Address, imageHash?: Hex.Hex) {
    this.sapientSigners.delete(this.getSapientKey(address, imageHash))
  }

  async isDeployed(provider: Provider.Provider): Promise<boolean> {
    return (await provider.request({ method: 'eth_getCode', params: [this.address, 'pending'] })) !== '0x'
  }

  async deploy(provider: Provider.Provider) {
    if (!(await this.isDeployed(provider))) {
      const transaction = await this.getDeployTransaction()
      return provider.request({ method: 'eth_sendTransaction', params: [transaction] })
    }
  }

  async getDeployTransaction(): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const deployInformation = await this.options.stateProvider.getDeploy(this.address)
    if (!deployInformation) {
      throw new Error(`cannot find deploy information for ${this.address}`)
    }
    return Erc6492.deploy(deployInformation.imageHash, deployInformation.context)
  }

  async setConfiguration(
    configuration: Config.Config,
    options?: { trustSigners?: boolean; onSignerError?: Config.SignerErrorCallback },
  ) {
    const imageHash = Config.hashConfiguration(configuration)
    const signature = await this.sign(Payload.fromConfigUpdate(Bytes.toHex(imageHash)), options)
    await this.options.stateProvider.saveUpdate(this.address, configuration, signature)
  }

  async getStatus(provider?: Provider.Provider): Promise<WalletStatus> {
    let isDeployed = false
    let implementation: Address.Address | undefined
    let stage: 'stage1' | 'stage2' | undefined
    let chainId: bigint | undefined
    let imageHash: Hex.Hex
    let updates: Array<{ imageHash: Hex.Hex; signature: SequenceSignature.RawSignature }> = []

    if (provider) {
      // Get chain ID, deployment status, and implementation
      const requests = await Promise.all([
        provider.request({ method: 'eth_chainId' }),
        this.isDeployed(provider),
        provider
          .request({
            method: 'eth_call',
            params: [{ to: this.address, data: AbiFunction.encodeData(Constants.GET_IMPLEMENTATION) }],
          })
          .then((res) => `0x${res.slice(26)}` as Address.Address)
          .catch(() => undefined),
      ])

      chainId = BigInt(requests[0])
      isDeployed = requests[1]
      implementation = requests[2]

      // Determine stage based on implementation address
      if (implementation) {
        if (implementation.toLowerCase() === this.options.context.stage1.toLowerCase()) {
          stage = 'stage1'
        } else {
          stage = 'stage2'
        }
      }

      // Get image hash and updates
      let fromImageHash: Hex.Hex
      if (isDeployed && stage === 'stage2') {
        // For deployed stage2 wallets, get the image hash from the contract
        fromImageHash = await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.IMAGE_HASH) }],
        })
      } else {
        // For non-deployed or stage1 wallets, get the deploy hash
        const deployInformation = await this.options.stateProvider.getDeploy(this.address)
        if (!deployInformation) {
          throw new Error(`cannot find deploy information for ${this.address}`)
        }
        fromImageHash = deployInformation.imageHash
      }

      // Get configuration updates
      updates = await this.options.stateProvider.getConfigurationUpdates(this.address, fromImageHash)
      imageHash = updates[updates.length - 1]?.imageHash ?? fromImageHash
    } else {
      // Without a provider, we can only get information from the state provider
      const deployInformation = await this.options.stateProvider.getDeploy(this.address)
      if (!deployInformation) {
        throw new Error(`cannot find deploy information for ${this.address}`)
      }
      updates = await this.options.stateProvider.getConfigurationUpdates(this.address, deployInformation.imageHash)
      imageHash = updates[updates.length - 1]?.imageHash ?? deployInformation.imageHash
    }

    // Get the current configuration
    const configuration = await this.options.stateProvider.getConfiguration(imageHash)
    if (!configuration) {
      throw new Error(`cannot find configuration details for ${this.address}`)
    }

    return {
      address: this.address,
      isDeployed,
      implementation,
      stage,
      configuration,
      imageHash,
      pendingUpdates: [...updates].reverse(),
      chainId,
    }
  }

  async send(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: { space?: bigint; trustSigners?: boolean; onSignerError?: Config.SignerErrorCallback },
  ) {
    return provider.request({
      method: 'eth_sendTransaction',
      params: [await this.getTransaction(provider, calls, options)],
    })
  }

  async getTransaction(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: { space?: bigint; trustSigners?: boolean; onSignerError?: Config.SignerErrorCallback },
  ): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const space = options?.space ?? 0n

    // Use getStatus to check if the wallet is deployed
    const status = await this.getStatus(provider)

    if (status.isDeployed) {
      const nonce = BigInt(
        await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.READ_NONCE, [space]) }],
        }),
      )

      const payload: Payload.Calls = { type: 'call', space, nonce, calls }
      const signature = await this.sign(payload, { ...options, provider, skip6492: true })

      return {
        to: this.address,
        data: AbiFunction.encodeData(Constants.EXECUTE, [
          Bytes.toHex(Payload.encode(payload)),
          Bytes.toHex(SequenceSignature.encodeSignature(signature)),
        ]),
      }
    } else {
      const nonce = 0n

      const payload: Payload.Calls = { type: 'call', space, nonce, calls }
      const [signature, deploy] = await Promise.all([
        this.sign(payload, { ...options, provider, skip6492: true }),
        this.getDeployTransaction(),
      ])

      return {
        to: this.options.guest,
        data: Bytes.toHex(
          Payload.encode({
            type: 'call',
            space: 0n,
            nonce: 0n,
            calls: [
              {
                to: deploy.to,
                value: 0n,
                data: Hex.toBytes(deploy.data),
                gasLimit: 0n,
                delegateCall: false,
                onlyFallback: false,
                behaviorOnError: 'revert',
              },
              {
                to: this.address,
                value: 0n,
                data: Hex.toBytes(
                  AbiFunction.encodeData(Constants.EXECUTE, [
                    Bytes.toHex(Payload.encode(payload)),
                    Bytes.toHex(SequenceSignature.encodeSignature(signature)),
                  ]),
                ),
                gasLimit: 0n,
                delegateCall: false,
                onlyFallback: false,
                behaviorOnError: 'revert',
              },
            ],
          }),
        ),
      }
    }
  }

  async sign(
    payload: Payload.Parented,
    options?: {
      skip6492?: boolean
      provider?: Provider.Provider
      trustSigners?: boolean
      onSignerError?: Config.SignerErrorCallback
    },
  ): Promise<SequenceSignature.RawSignature> {
    const provider = options?.provider

    // Use getStatus to get the wallet status
    const status = await this.getStatus(provider)

    const chainId = status.chainId ?? 0n

    // Get deploy hash if needed for ERC-6492
    let deployHash: { deployHash: Hex.Hex; context: Context.Context } | undefined
    if (!status.isDeployed || status.stage === 'stage1') {
      const deployInformation = await this.options.stateProvider.getDeploy(this.address)
      if (!deployInformation) {
        throw new Error(`cannot find deploy information for ${this.address}`)
      }
      deployHash = { deployHash: deployInformation.imageHash, context: deployInformation.context }
    }

    const configuration = status.configuration
    const updates = status.pendingUpdates

    const topology = await Config.sign(
      configuration.topology,
      {
        sign: (leaf) => {
          const signer = this.signers.get(leaf.address)
          if (!signer) {
            throw new Error(`no signer ${leaf.address}`)
          }
          if (typeof signer.signer.sign !== 'function') {
            throw new Error(`${leaf.address} does not implement Signer.sign()`)
          }

          const signature = Config.normalizeSignerSignature(signer.signer.sign(this.address, chainId, payload))

          signature.signature = signature.signature.then((signature) => {
            if (signature.type === 'erc1271') {
              if (signature.address !== leaf.address) {
                throw new Error(
                  `expected erc-1271 signature by ${leaf.address}, but received signature from ${signature.address}`,
                )
              }
              if (!provider) {
                throw new Error(`erc-1271 signer ${leaf.address} cannot sign for a no-chain-id signature`)
              }
            }

            return signature
          })

          if (options?.trustSigners === false || (!options?.trustSigners && !signer.isTrusted)) {
            signature.signature = signature.signature.then(async (signature) => {
              const digest = Payload.hash(this.address, chainId, payload)

              switch (signature.type) {
                case 'eth_sign':
                case 'hash':
                  if (
                    !Secp256k1.verify({
                      payload: signature.type === 'eth_sign' ? PersonalMessage.getSignPayload(digest) : digest,
                      address: leaf.address,
                      signature,
                    })
                  ) {
                    throw new Error(`invalid signature for ${leaf.type} signer ${leaf.address}`)
                  }
                  break

                case 'erc1271':
                  if (!provider) {
                    throw new Error(`erc-1271 signatures are not valid for no-chain-id signatures`)
                  }
                  if (
                    (await provider.request({
                      method: 'eth_call',
                      params: [
                        {
                          to: leaf.address,
                          data: AbiFunction.encodeData(Constants.IS_VALID_SIGNATURE, [
                            Bytes.toHex(digest),
                            Bytes.toHex(signature.data),
                          ]),
                        },
                      ],
                    })) !== AbiFunction.getSelector(Constants.IS_VALID_SIGNATURE)
                  ) {
                    throw new Error(`invalid signature for erc-1271 signer ${leaf.address}`)
                  }
                  break
              }

              return signature
            })
          }

          return signature
        },
        signSapient: (leaf) => {
          // If we have a signer for this imageHash, we give it priority
          // if not, then we fetch the signer for any imageHash (undefined)
          const signer =
            this.sapientSigners.get(this.getSapientKey(leaf.address, Hex.fromBytes(leaf.imageHash))) ||
            this.sapientSigners.get(this.getSapientKey(leaf.address, undefined))

          if (!signer) {
            throw new Error(`no signer ${leaf.address}`)
          }
          if (typeof signer.signer.signSapient !== 'function') {
            throw new Error(`${leaf.address} does not implement Signer.signSapient()`)
          }

          const signature = Config.normalizeSignerSignature(
            signer.signer.signSapient(this.address, chainId, payload, Bytes.toHex(leaf.imageHash)),
          )

          signature.signature = signature.signature.then((signature) => {
            if (signature.address !== leaf.address) {
              throw new Error(
                `expected sapient signature by ${leaf.address}, but received signature from ${signature.address}`,
              )
            }

            return signature
          })

          if (options?.trustSigners === false || (!options?.trustSigners && !signer.isTrusted)) {
            signature.signature = signature.signature.then(async (signature) => {
              if (!provider) {
                throw new Error(`sapient signer ${leaf.address} cannot sign for a no-chain-id signature`)
              }

              const digest = Payload.hash(this.address, chainId, payload)

              switch (signature.type) {
                case 'sapient': {
                  const imageHash = await provider.request({
                    method: 'eth_call',
                    params: [
                      {
                        to: leaf.address,
                        data: AbiFunction.encodeData(Constants.IS_VALID_SAPIENT_SIGNATURE, [
                          Payload.encodeSapient(chainId, payload),
                          Bytes.toHex(signature.data),
                        ]),
                      },
                    ],
                  })
                  if (imageHash !== Bytes.toHex(leaf.imageHash)) {
                    throw new Error(
                      `invalid sapient signature for ${leaf.type} signer ${leaf.address}: expected ${leaf.imageHash}, derived ${imageHash}`,
                    )
                  }
                  break
                }

                case 'sapient_compact': {
                  const imageHash = await provider.request({
                    method: 'eth_call',
                    params: [
                      {
                        to: leaf.address,
                        data: AbiFunction.encodeData(Constants.IS_VALID_SAPIENT_SIGNATURE_COMPACT, [
                          Bytes.toHex(digest),
                          Bytes.toHex(signature.data),
                        ]),
                      },
                    ],
                  })
                  if (imageHash !== Bytes.toHex(leaf.imageHash)) {
                    throw new Error(
                      `invalid sapient signature for ${leaf.type} signer ${leaf.address}: expected ${leaf.imageHash}, derived ${imageHash}`,
                    )
                  }
                  break
                }
              }

              return signature
            })
          }

          return signature
        },
      },
      {
        threshold: configuration.threshold,
        onSignerError: (leaf, error) => {
          options?.onSignerError?.(leaf, error)
          this.options.onSignerError?.(leaf, error)
        },
      },
    )

    const erc6492 =
      !status.isDeployed && deployHash && !options?.skip6492
        ? Erc6492.deploy(deployHash.deployHash, deployHash.context)
        : undefined

    return {
      noChainId: !chainId,
      configuration: { ...configuration, topology },
      suffix: updates.map(({ signature }) => signature),
      erc6492: erc6492 && { ...erc6492, data: Hex.toBytes(erc6492.data) },
    }
  }
}

type Unpromise<T> = T extends Promise<infer S> ? S : T

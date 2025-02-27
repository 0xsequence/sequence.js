import { AbiFunction, Address, Bytes, Hex, PersonalMessage, Provider, Secp256k1, Signature } from 'ox'
import { MemoryStateProvider, StateProvider } from '.'
import {
  Constants,
  Context,
  WalletConfig,
  Address as SequenceAddress,
  Erc6492,
  Payload,
  Signature as SequenceSignature,
} from '@0xsequence/sequence-primitives'

export type WalletOptions = {
  context: Context.Context
  stateProvider: StateProvider
  onSignerError?: WalletConfig.SignerErrorCallback
  guest: Address.Address
}

export const DefaultWalletOptions: WalletOptions = {
  context: Context.Dev1,
  stateProvider: new MemoryStateProvider(),
  guest: Constants.DefaultGuest,
}

export class Wallet {
  private readonly signers = new Map<Address.Address, { signer: Signer; isTrusted: boolean }>()
  private readonly options: WalletOptions & { stateProvider: StateProvider }

  constructor(
    readonly address: Address.Address,
    options?: Partial<WalletOptions>,
  ) {
    this.options = { ...DefaultWalletOptions, ...options }
  }

  static async fromConfiguration(
    configuration: WalletConfig.Configuration,
    options?: Partial<WalletOptions>,
  ): Promise<Wallet> {
    const merged = { ...DefaultWalletOptions, ...options }
    await merged.stateProvider.saveWallet(configuration, merged.context)
    return new Wallet(SequenceAddress.from(configuration, merged.context), merged)
  }

  async setSigner(signer: Signer, isTrusted = false) {
    this.signers.set(await signer.address, { signer, isTrusted })
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
    const { deployHash, context } = await this.options.stateProvider.getDeployHash(this.address)
    return Erc6492.deploy(deployHash, context)
  }

  async setConfiguration(
    configuration: WalletConfig.Configuration,
    options?: { trustSigners?: boolean; onSignerError?: WalletConfig.SignerErrorCallback },
  ) {
    const imageHash = WalletConfig.hashConfiguration(configuration)
    const signature = await this.sign(Payload.fromConfigUpdate(Bytes.toHex(imageHash)), options)
    await this.options.stateProvider.setConfiguration(this.address, configuration, signature)
  }

  async send(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: { space?: bigint; trustSigners?: boolean; onSignerError?: WalletConfig.SignerErrorCallback },
  ) {
    return provider.request({
      method: 'eth_sendTransaction',
      params: [await this.getTransaction(provider, calls, options)],
    })
  }

  async getTransaction(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: { space?: bigint; trustSigners?: boolean; onSignerError?: WalletConfig.SignerErrorCallback },
  ): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const space = options?.space ?? 0n

    if (await this.isDeployed(provider)) {
      const nonce = BigInt(
        await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.READ_NONCE, [space]) }],
        }),
      )

      const payload: Payload.Calls = { type: 'call', space, nonce, calls }
      const signature = await this.sign(payload, { ...options, provider })

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
        this.sign(payload, { ...options, provider }),
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
      provider?: Provider.Provider
      trustSigners?: boolean
      onSignerError?: WalletConfig.SignerErrorCallback
    },
  ): Promise<SequenceSignature.RawSignature> {
    const provider = options?.provider

    let updates: Unpromise<ReturnType<StateProvider['getConfigurationUpdates']>> = []

    let chainId: bigint
    let isDeployed: boolean
    let deployHash: { deployHash: Hex.Hex; context: Context.Context } | undefined
    let imageHash: Hex.Hex
    if (provider) {
      const requests = await Promise.all([
        provider.request({ method: 'eth_chainId' }),
        this.isDeployed(provider),
        provider
          .request({
            method: 'eth_call',
            params: [{ to: this.address, data: AbiFunction.encodeData(Constants.GET_IMPLEMENTATION) }],
          })
          .then((res) => `0x${res.slice(26)}`)
          .catch(() => undefined),
      ])

      chainId = BigInt(requests[0])
      isDeployed = requests[1]
      const implementation = requests[2]

      let fromImageHash: Hex.Hex

      if (isDeployed && implementation?.toLowerCase() !== this.options.context.stage1.toLowerCase()) {
        fromImageHash = await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.IMAGE_HASH) }],
        })
      } else {
        // Avoid setting deployHash as it later determines if we use 6492 or not
        fromImageHash = (await this.options.stateProvider.getDeployHash(this.address)).deployHash
      }

      updates = await this.options.stateProvider.getConfigurationUpdates(this.address, fromImageHash)
      imageHash = updates[updates.length - 1]?.imageHash ?? fromImageHash
    } else {
      chainId = 0n
      isDeployed = true

      const { deployHash } = await this.options.stateProvider.getDeployHash(this.address)

      const updates = await this.options.stateProvider.getConfigurationUpdates(this.address, deployHash)

      imageHash = updates[updates.length - 1]?.imageHash ?? deployHash
    }

    const configuration = await this.options.stateProvider.getConfiguration(imageHash)

    const topology = await WalletConfig.sign(
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

          const signature = WalletConfig.normalizeSignerSignature(signer.signer.sign(this.address, chainId, payload))

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
        signSapient: provider
          ? (leaf) => {
              const signer = this.signers.get(leaf.address)
              if (!signer) {
                throw new Error(`no signer ${leaf.address}`)
              }
              if (typeof signer.signer.signSapient !== 'function') {
                throw new Error(`${leaf.address} does not implement Signer.signSapient()`)
              }

              const signature = WalletConfig.normalizeSignerSignature(
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
            }
          : undefined,
      },
      {
        threshold: configuration.threshold,
        onSignerError: (leaf, error) => {
          options?.onSignerError?.(leaf, error)
          this.options.onSignerError?.(leaf, error)
        },
      },
    )

    const erc6492 = deployHash && Erc6492.deploy(deployHash.deployHash, deployHash.context)

    return {
      noChainId: !chainId,
      configuration: { ...configuration, topology },
      suffix: updates.reverse().map(({ signature }) => signature),
      erc6492: erc6492 && { ...erc6492, data: Hex.toBytes(erc6492.data) },
    }
  }
}

export interface Signer {
  readonly address: MaybePromise<Address.Address>

  sign?: (
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
  ) => WalletConfig.SignerSignature<SequenceSignature.SignatureOfSignerLeaf>

  signSapient?: (
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ) => WalletConfig.SignerSignature<SequenceSignature.SignatureOfSapientSignerLeaf>
}

type MaybePromise<T> = T | Promise<T>
type Unpromise<T> = T extends Promise<infer S> ? S : T

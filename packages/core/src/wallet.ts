import {
  Configuration,
  Context,
  DevContext1,
  encodeSapient,
  erc6492Deploy,
  fromConfigUpdate,
  getCounterfactualAddress,
  hash,
  hashConfiguration,
  IMAGE_HASH,
  IS_VALID_SAPIENT_SIGNATURE,
  IS_VALID_SAPIENT_SIGNATURE_COMPACT,
  IS_VALID_SIGNATURE,
  normalizeSignerSignature,
  ParentedPayload,
  RawSignature,
  sign,
  SignatureOfSapientSignerLeaf,
  SignatureOfSignerLeaf,
  SignerErrorCallback,
  SignerSignature,
} from '@0xsequence/sequence-primitives'
import { AbiFunction, Address, Bytes, Hex, PersonalMessage, Provider, Secp256k1, Signature } from 'ox'
import { MemoryStateProvider, StateProvider } from '.'

export type WalletOptions = {
  context: Context
  stateProvider: StateProvider
  onSignerError?: SignerErrorCallback
}

export const DefaultWalletOptions: WalletOptions = {
  context: DevContext1,
  stateProvider: new MemoryStateProvider(),
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

  static async fromConfiguration(configuration: Configuration, options?: Partial<WalletOptions>): Promise<Wallet> {
    const merged = { ...DefaultWalletOptions, ...options }
    await merged.stateProvider.saveWallet(configuration, merged.context)
    return new Wallet(getCounterfactualAddress(configuration, merged.context), merged)
  }

  async setSigner(signer: Signer, isTrusted = false) {
    this.signers.set(await signer.address, { signer, isTrusted })
  }

  async isDeployed(provider: Provider.Provider): Promise<boolean> {
    return (await provider.request({ method: 'eth_getCode', params: [this.address, 'pending'] })) !== '0x'
  }

  async deploy(provider: Provider.Provider) {
    if (!(await this.isDeployed(provider))) {
      return provider.request({ method: 'eth_sendTransaction', params: [await this.getDeployTransaction()] })
    }
  }

  async getDeployTransaction(): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const { deployHash, context } = await this.options.stateProvider.getDeployHash(this.address)
    return erc6492Deploy(deployHash, context)
  }

  async setConfiguration(
    configuration: Configuration,
    options?: { trustSigners?: boolean; onSignerError?: SignerErrorCallback },
  ) {
    const imageHash = hashConfiguration(configuration)
    const signature = await this.sign(fromConfigUpdate(Bytes.toHex(imageHash)), options)
    await this.options.stateProvider.setConfiguration(this.address, configuration, signature)
  }

  async sign(
    payload: ParentedPayload,
    options?: { provider?: Provider.Provider; trustSigners?: boolean; onSignerError?: SignerErrorCallback },
  ): Promise<RawSignature> {
    const provider = options?.provider

    let updates: Unpromise<ReturnType<StateProvider['getConfigurationUpdates']>> = []

    let chainId: bigint
    let isDeployed: boolean
    let deployHash: { deployHash: Hex.Hex; context: Context } | undefined
    let imageHash: Hex.Hex
    if (provider) {
      const requests = await Promise.all([provider.request({ method: 'eth_chainId' }), this.isDeployed(provider)])
      chainId = BigInt(requests[0])
      isDeployed = requests[1]

      let fromImageHash: Hex.Hex
      if (isDeployed) {
        fromImageHash = await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(IMAGE_HASH) }],
        })
      } else {
        deployHash = await this.options.stateProvider.getDeployHash(this.address)
        fromImageHash = deployHash.deployHash
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

    const topology = await sign(
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

          const signature = normalizeSignerSignature(signer.signer.sign(this.address, chainId, payload))

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
              const digest = hash(this.address, chainId, payload)

              switch (signature.type) {
                case 'eth_sign':
                case 'hash':
                  if (
                    !Secp256k1.verify({
                      payload: signature.type === 'eth_sign' ? PersonalMessage.getSignPayload(digest) : digest,
                      address: this.address,
                      signature: {
                        r: Bytes.toBigInt(signature.r),
                        s: Bytes.toBigInt(signature.s),
                        yParity: Signature.vToYParity(signature.v),
                      },
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
                          data: AbiFunction.encodeData(IS_VALID_SIGNATURE, [
                            Bytes.toHex(digest),
                            Bytes.toHex(signature.data),
                          ]),
                        },
                      ],
                    })) !== AbiFunction.getSelector(IS_VALID_SIGNATURE)
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

              const signature = normalizeSignerSignature(
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
                  const digest = hash(this.address, chainId, payload)

                  switch (signature.type) {
                    case 'sapient': {
                      const imageHash = await provider.request({
                        method: 'eth_call',
                        params: [
                          {
                            to: leaf.address,
                            data: AbiFunction.encodeData(IS_VALID_SAPIENT_SIGNATURE, [
                              encodeSapient(chainId, payload),
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
                            data: AbiFunction.encodeData(IS_VALID_SAPIENT_SIGNATURE_COMPACT, [
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

    const erc6492 = deployHash && erc6492Deploy(deployHash.deployHash, deployHash.context)

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

  sign?: (wallet: Address.Address, chainId: bigint, payload: ParentedPayload) => SignerSignature<SignatureOfSignerLeaf>

  signSapient?: (
    wallet: Address.Address,
    chainId: bigint,
    payload: ParentedPayload,
    imageHash: Hex.Hex,
  ) => SignerSignature<SignatureOfSapientSignerLeaf>
}

type MaybePromise<T> = T | Promise<T>
type Unpromise<T> = T extends Promise<infer S> ? S : T

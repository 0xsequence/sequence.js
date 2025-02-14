import {
  Configuration,
  Context,
  decodeSignature,
  DevContext1,
  encodeSignature,
  erc6492,
  erc6492Deploy,
  fillLeaves,
  fromConfigUpdate,
  getCounterfactualAddress,
  getSigners,
  getWeight,
  hashConfiguration,
  IMAGE_HASH,
  isSignerLeaf,
  Payload,
  RawSignature,
} from '@0xsequence/sequence-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider, Signature as oxSignature } from 'ox'
import { CancelCallback, Signature, Signer, SignerSignatureCallback } from './signer'
import { StateReader, StateWriter } from './state'
import { MemoryStore } from './state/memory'

export type WalletOptions = {
  context: Context
  stateProvider: StateReader & StateWriter
}

export const DefaultWalletOptions: WalletOptions = {
  context: DevContext1,
  stateProvider: new MemoryStore(),
}

export class Wallet {
  private readonly signers = new Map<Address.Address, Signer>()
  private readonly stateProvider: StateReader & StateWriter

  constructor(
    readonly address: Address.Address,
    readonly options: Partial<WalletOptions> = {},
  ) {
    const mergedOptions = { ...DefaultWalletOptions, ...options }
    this.stateProvider = mergedOptions.stateProvider!
  }

  static async fromConfiguration(configuration: Configuration, options: Partial<WalletOptions> = {}): Promise<Wallet> {
    const mergedOptions = { ...DefaultWalletOptions, ...options }

    await mergedOptions.stateProvider.saveWallet(configuration, mergedOptions.context)
    return new Wallet(getCounterfactualAddress(configuration, mergedOptions.context), mergedOptions)
  }

  async setSigner(signer: Signer) {
    this.signers.set(await signer.address, signer)
  }

  async isDeployed(provider: Provider.Provider): Promise<boolean> {
    const code = await provider.request({ method: 'eth_getCode', params: [this.address, 'latest'] })
    return code !== '0x'
  }

  async deploy(provider: Provider.Provider): Promise<void> {
    console.log('called deploy')
    if (await this.isDeployed(provider)) {
      throw new Error('Wallet is already deployed')
    }

    const { hash: imageHash, context } = await this.stateProvider.getDeployHash(this.address)
    const deployData = erc6492Deploy(imageHash, context)

    await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          to: deployData.to,
          data: deployData.data,
          gas: '0x27100',
        },
      ],
    })
  }

  async setConfiguration(configuration: Configuration, options?: { force: boolean }) {
    if (!options?.force) {
    }

    const imageHash = Bytes.toHex(hashConfiguration(configuration))
    const signature = Bytes.toHex(await this.sign(fromConfigUpdate(imageHash)))
    return this.stateProvider.setConfiguration(this.address, configuration, signature)
  }

  async sign(
    payload: Payload,
    provider?: Provider.Provider,
    options?: { trustSigners?: boolean; onSignerError?: (signer: Address.Address, error: any) => void },
  ): Promise<Bytes.Bytes> {
    const signatures: Array<RawSignature & { checkpointerData: undefined }> = []

    let chainId: bigint
    let isDeployed: boolean
    let imageHash: Hex.Hex
    let deployContext: Context

    if (provider) {
      const responses = await Promise.all([provider.request({ method: 'eth_chainId' }), this.isDeployed(provider)])

      chainId = BigInt(responses[0])
      isDeployed = responses[1]

      if (!isDeployed) {
        const { hash, context } = await this.stateProvider.getDeployHash(this.address)
        imageHash = hash
        deployContext = context
      } else {
        imageHash = await provider.request({
          method: 'eth_call',
          params: [{ data: AbiFunction.encodeData(IMAGE_HASH) }],
        })
      }

      const path = await this.stateProvider.getConfigurationPath(this.address, imageHash)

      signatures.push(
        ...path.map(({ signature }) => {
          const decoded = decodeSignature(Hex.toBytes(signature))
          if (decoded.checkpointerData) {
            throw new Error('chained subsignature has checkpointer data')
          }
          return { ...decoded, checkpointerData: undefined }
        }),
      )
    } else {
      chainId = 0n
      isDeployed = true

      const { hash, context } = await this.stateProvider.getDeployHash(this.address)
      imageHash = hash
      deployContext = context

      const path = await this.stateProvider.getConfigurationPath(this.address, imageHash)
      if (path.length) {
        imageHash = path[path.length - 1]!.imageHash
      }
    }

    const configuration = await this.stateProvider.getConfiguration(imageHash)

    const signers = new Map<
      Address.Address,
      { signer: Signer; signature?: Signature; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }
    >(
      getSigners(configuration).signers.flatMap((address) => {
        const signer = this.signers.get(address)
        return signer ? [[address, { signer }]] : []
      }),
    )

    if (getWeight(configuration, (signer) => signers.has(signer.address)).maxWeight < configuration.threshold) {
      throw new Error('insufficient max weight')
    }

    const signerSignatures = await new Promise<Map<Address.Address, Signature>>((resolve, reject) => {
      const onError = (address: Hex.Hex) => (error: any) => {
        signers.delete(address)

        options?.onSignerError?.(address, error)

        if (getWeight(configuration, (signer) => signers.has(signer.address)).maxWeight < configuration.threshold) {
          const onCancels = Array.from(signers.values()).flatMap(({ onCancel }) => (onCancel ? [onCancel] : []))
          signers.clear()
          onCancels.forEach((onCancel) => onCancel(false))
          reject(new Error('insufficient max weight'))
        }
      }

      const onSignerSignature = (address: Hex.Hex) => (signature: Signature) => {
        if (!options?.trustSigners) {
        }

        const signer = signers.get(address)!
        signer.signature = signature
        delete signer.onSignerSignature
        delete signer.onCancel

        const signerSignatures = new Map(
          Array.from(signers.entries()).flatMap(([address, { signature }]) =>
            signature ? [[address, signature]] : [],
          ),
        )

        if (
          getWeight(configuration, (signer) => signers.get(signer.address)?.signature !== undefined).weight <
          configuration.threshold
        ) {
          Array.from(signers.values()).forEach(({ onSignerSignature }) =>
            onSignerSignature?.(configuration, signerSignatures, !options?.trustSigners),
          )
        } else {
          const onCancels = Array.from(signers.values()).flatMap(({ onCancel }) => (onCancel ? [onCancel] : []))
          signers.clear()
          onCancels.forEach((onCancel) => onCancel(true))
          resolve(signerSignatures)
        }
      }

      for (const [address, signer] of signers.entries()) {
        try {
          const result = signer.signer.sign(payload)

          if ('type' in result) {
            Promise.resolve(result).then(onSignerSignature(address)).catch(onError(address))
          } else if (result instanceof Promise) {
            result.then(onSignerSignature(address)).catch(onError(address))
          } else {
            result.signature.then(onSignerSignature(address)).catch(onError(address))
            signer.onSignerSignature = result.onSignerSignature
            signer.onCancel = result.onCancel
          }
        } catch (error) {
          Promise.resolve(error).then(onError(address))
        }
      }
    })

    const signature = encodeSignature({
      noChainId: !chainId,
      configuration: {
        ...configuration,
        topology: fillLeaves(configuration.topology, (leaf) => {
          const signerSignature = signerSignatures.get(leaf.address)
          if (!signerSignature) {
            return
          }

          if (isSignerLeaf(leaf)) {
            switch (signerSignature.type) {
              case 'hash': {
                const { r, s, yParity } = oxSignature.fromHex(signerSignature.signature)
                return {
                  type: 'hash',
                  r: Bytes.fromNumber(r),
                  s: Bytes.fromNumber(s),
                  v: oxSignature.yParityToV(yParity),
                }
              }

              case 'eth_sign': {
                const { r, s, yParity } = oxSignature.fromHex(signerSignature.signature)
                return {
                  type: 'eth_sign',
                  r: Bytes.fromNumber(r),
                  s: Bytes.fromNumber(s),
                  v: oxSignature.yParityToV(yParity),
                }
              }

              case 'erc-1271': {
                return { type: 'erc1271', address: leaf.address, data: Hex.toBytes(signerSignature.signature) }
              }

              case 'sapient':
              case 'sapient-compact': {
                throw new Error(`signature is ${signerSignature.type}, but ${leaf.address} is not a sapient signer`)
              }
            }
          } else {
            switch (signerSignature.type) {
              case 'hash':
              case 'eth_sign':
              case 'erc-1271': {
                throw new Error(
                  `expected ${leaf.address} to be a sapient signer, but signature is ${signerSignature.type}`,
                )
              }

              case 'sapient': {
                return { type: 'sapient', address: leaf.address, data: Hex.toBytes(signerSignature.signature) }
              }

              case 'sapient-compact': {
                return { type: 'sapient_compact', address: leaf.address, data: Hex.toBytes(signerSignature.signature) }
              }
            }
          }
        }),
      },
      suffix: signatures.reverse(),
    })

    return isDeployed ? signature : erc6492(signature, erc6492Deploy(imageHash, deployContext!))
  }
}

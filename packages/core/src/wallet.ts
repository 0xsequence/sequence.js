import {
  Configuration,
  fromConfigUpdate,
  getCounterfactualAddress,
  getSigners,
  getWeight,
  hashConfiguration,
  Payload,
} from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex, Provider } from 'ox'
import { CancelCallback, Signer, SignerSignatureCallback } from './signer'
import { Sessions, StateReader, StateWriter } from './state'

export class Wallet {
  private readonly signers = new Map<Address.Address, Signer>()
  private readonly stateProvider: StateReader & StateWriter

  constructor(readonly address: Address.Address) {
    this.stateProvider = new Sessions()
  }

  static fromConfiguration(configuration: Configuration): Wallet {
    return new Wallet(getCounterfactualAddress(configuration))
  }

  async setSigner(signer: Signer) {
    this.signers.set(await signer.address, signer)
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
    const signatures: Hex.Hex[] = []

    let chainId: bigint
    let isDeployed: boolean
    let imageHash: Hex.Hex
    if (provider) {
      const responses = await Promise.all([
        provider.request({ method: 'eth_chainId' }),
        provider.request({ method: 'eth_getCode', params: [this.address, 'latest'] }),
      ])

      chainId = BigInt(responses[0])

      const code = responses[1]
      if (code === '0x') {
        isDeployed = false
        imageHash = await this.stateProvider.getDeployHash(this.address)
      } else {
        isDeployed = true
        imageHash = await provider.request({ method: 'eth_call', params: [{ data: '0x51605d80' /* imageHash() */ }] })
      }

      const path = await this.stateProvider.getConfigurationPath(this.address, imageHash)
      signatures.push(...path.map(({ signature }) => signature))
    } else {
      chainId = 0n
      isDeployed = true

      imageHash = await this.stateProvider.getDeployHash(this.address)
      const path = await this.stateProvider.getConfigurationPath(this.address, imageHash)
      if (path.length) {
        imageHash = path[path.length - 1]!.imageHash
      }
    }

    const configuration = await this.stateProvider.getConfiguration(imageHash)

    const signers = new Map<
      Address.Address,
      { signer: Signer; signature?: Hex.Hex; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }
    >(
      getSigners(configuration).signers.flatMap((address) => {
        const signer = this.signers.get(address)
        return signer ? [[address, { signer }]] : []
      }),
    )

    if (getWeight(configuration, Array.from(signers.keys())) < configuration.threshold) {
      throw new Error('insufficient potential weight')
    }

    const signerSignatures = await new Promise<Map<Address.Address, Hex.Hex>>((resolve, reject) => {
      const onError = (address: Hex.Hex) => (error: any) => {
        signers.delete(address)

        options?.onSignerError?.(address, error)

        if (getWeight(configuration, Array.from(signers.keys())) < configuration.threshold) {
          const onCancels = Array.from(signers.values()).flatMap(({ onCancel }) => (onCancel ? [onCancel] : []))
          signers.clear()
          onCancels.forEach((onCancel) => onCancel(false))
          reject(new Error('insufficient potential weight'))
        }
      }

      const onSignerSignature = (address: Hex.Hex) => (signature: Hex.Hex) => {
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

        const weight = getWeight(
          configuration,
          Array.from(signers.entries()).flatMap(([address, { signature }]) => (signature ? [address] : [])),
        )

        if (weight < configuration.threshold) {
          Array.from(signers.values()).forEach(({ onSignerSignature }) =>
            onSignerSignature?.(configuration, signerSignatures),
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

          if (result instanceof Promise) {
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
  }
}

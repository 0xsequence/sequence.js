import {
  Config,
  Constants,
  Context,
  Erc6492,
  Payload,
  Address as SequenceAddress,
  Signature as SequenceSignature,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider } from 'ox'
import * as Envelope from './envelope.js'
import * as State from './state/index.js'

export type WalletOptions = {
  context: Context.Context
  stateProvider: State.Provider
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
  public readonly context: Context.Context
  public readonly guest: Address.Address
  public readonly stateProvider: State.Provider

  constructor(
    readonly address: Address.Address,
    options?: Partial<WalletOptions>,
  ) {
    const combinedOptions = { ...DefaultWalletOptions, ...options }
    this.context = combinedOptions.context
    this.guest = combinedOptions.guest
    this.stateProvider = combinedOptions.stateProvider
  }

  static async fromConfiguration(configuration: Config.Config, options?: Partial<WalletOptions>): Promise<Wallet> {
    const merged = { ...DefaultWalletOptions, ...options }
    //FIXME Validate configuration (weights not too large, total weights above threshold, etc)
    await merged.stateProvider.saveWallet(configuration, merged.context)
    return new Wallet(SequenceAddress.from(configuration, merged.context), merged)
  }

  async isDeployed(provider: Provider.Provider): Promise<boolean> {
    return (await provider.request({ method: 'eth_getCode', params: [this.address, 'pending'] })) !== '0x'
  }

  async buildDeployTransaction(): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const deployInformation = await this.stateProvider.getDeploy(this.address)
    if (!deployInformation) {
      throw new Error(`cannot find deploy information for ${this.address}`)
    }
    return Erc6492.deploy(deployInformation.imageHash, deployInformation.context)
  }

  async prepareUpdate(configuration: Config.Config): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const imageHash = Config.hashConfiguration(configuration)
    const blankEvelope = (
      await Promise.all([
        this.prepareBlankEnvelope(0n),
        // TODO: Add save configuration
        this.stateProvider.saveWallet(configuration, this.context),
      ])
    )[0]

    return {
      ...blankEvelope,
      payload: Payload.fromConfigUpdate(Bytes.toHex(imageHash)),
    }
  }

  async submitUpdate(
    envelope: Envelope.Signed<Payload.ConfigUpdate>,
    options?: { validateSave?: boolean },
  ): Promise<void> {
    const [status, newConfig] = await Promise.all([
      this.getStatus(),
      this.stateProvider.getConfiguration(envelope.payload.imageHash),
    ])

    if (!newConfig) {
      throw new Error(`cannot find configuration details for ${envelope.payload.imageHash}`)
    }

    // Verify the new configuration is valid
    const updatedEnvelope = { ...envelope, configuration: status.configuration }
    const { weight, threshold } = Envelope.weightOf(updatedEnvelope)
    if (weight < threshold) {
      throw new Error('insufficient weight in envelope')
    }

    const signature = Envelope.encodeSignature(updatedEnvelope)
    await this.stateProvider.saveUpdate(this.address, newConfig, signature)

    if (options?.validateSave) {
      const status = await this.getStatus()
      if (Hex.from(Config.hashConfiguration(status.configuration)) !== envelope.payload.imageHash) {
        throw new Error('configuration not saved')
      }
    }
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
          .then((res) => {
            const address = `0x${res.slice(-40)}`
            Address.assert(address, { strict: false })
            return address
          })
          .catch(() => undefined),
      ])

      chainId = BigInt(requests[0])
      isDeployed = requests[1]
      implementation = requests[2]

      // Determine stage based on implementation address
      if (implementation) {
        if (Address.isEqual(implementation, this.context.stage1)) {
          stage = 'stage1'
        } else if (Address.isEqual(implementation, this.context.stage2)) {
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
        const deployInformation = await this.stateProvider.getDeploy(this.address)
        if (!deployInformation) {
          throw new Error(`cannot find deploy information for ${this.address}`)
        }
        fromImageHash = deployInformation.imageHash
      }

      // Get configuration updates
      updates = await this.stateProvider.getConfigurationUpdates(this.address, fromImageHash)
      imageHash = updates[updates.length - 1]?.imageHash ?? fromImageHash
    } else {
      // Without a provider, we can only get information from the state provider
      const deployInformation = await this.stateProvider.getDeploy(this.address)
      if (!deployInformation) {
        throw new Error(`cannot find deploy information for ${this.address}`)
      }
      updates = await this.stateProvider.getConfigurationUpdates(this.address, deployInformation.imageHash)
      imageHash = updates[updates.length - 1]?.imageHash ?? deployInformation.imageHash
    }

    // Get the current configuration
    const configuration = await this.stateProvider.getConfiguration(imageHash)
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

  async prepareTransaction(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: { space?: bigint },
  ): Promise<Envelope.Envelope<Payload.Calls>> {
    const space = options?.space ?? 0n
    const status = await this.getStatus(provider)

    let nonce: bigint = 0n
    if (status.isDeployed) {
      nonce = BigInt(
        await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.READ_NONCE, [space]) }],
        }),
      )
    }

    return {
      payload: {
        type: 'call',
        space,
        nonce,
        calls,
      },
      ...(await this.prepareBlankEnvelope(status.chainId ?? 0n)),
    }
  }

  async buildTransaction(provider: Provider.Provider, envelope: Envelope.Signed<Payload.Calls>) {
    const status = await this.getStatus(provider)

    const updatedEnvelope = { ...envelope, configuration: status.configuration }
    const { weight, threshold } = Envelope.weightOf(updatedEnvelope)
    if (weight < threshold) {
      throw new Error('insufficient weight in envelope')
    }

    const signature = Envelope.encodeSignature(updatedEnvelope)

    if (status.isDeployed) {
      return {
        to: this.address,
        data: AbiFunction.encodeData(Constants.EXECUTE, [
          Bytes.toHex(Payload.encode(envelope.payload)),
          Bytes.toHex(
            SequenceSignature.encodeSignature({
              ...signature,
              suffix: status.pendingUpdates.map(({ signature }) => signature),
            }),
          ),
        ]),
      }
    } else {
      const deploy = await this.buildDeployTransaction()

      return {
        to: this.guest,
        data: Bytes.toHex(
          Payload.encode({
            type: 'call',
            space: 0n,
            nonce: 0n,
            calls: [
              {
                to: deploy.to,
                value: 0n,
                data: deploy.data,
                gasLimit: 0n,
                delegateCall: false,
                onlyFallback: false,
                behaviorOnError: 'revert',
              },
              {
                to: this.address,
                value: 0n,
                data: AbiFunction.encodeData(Constants.EXECUTE, [
                  Bytes.toHex(Payload.encode(envelope.payload)),
                  Bytes.toHex(
                    SequenceSignature.encodeSignature({
                      ...signature,
                      suffix: status.pendingUpdates.map(({ signature }) => signature),
                    }),
                  ),
                ]),
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

  private async prepareBlankEnvelope(chainId: bigint) {
    const status = await this.getStatus()

    return {
      wallet: this.address,
      chainId: chainId,
      configuration: status.configuration,
    }
  }
}

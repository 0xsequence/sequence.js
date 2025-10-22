import {
  Config,
  Constants,
  Context,
  Erc6492,
  Payload,
  Address as SequenceAddress,
  Signature as SequenceSignature,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, AbiParameters, Address, Bytes, Hex, Provider, TypedData } from 'ox'
import * as Envelope from './envelope.js'
import * as State from './state/index.js'
import { UserOperation } from 'ox/erc4337'
import { encodeMigration } from './utils/migration/migration-encoder.js'

export type WalletOptions = {
  knownContexts: Context.KnownContext[]
  stateProvider: State.Provider
  guest: Address.Address
  unsafe?: boolean
}

export const DefaultWalletOptions: WalletOptions = {
  knownContexts: Context.KnownContexts,
  stateProvider: new State.Sequence.Provider(),
  guest: Constants.DefaultGuestAddress,
}

export type WalletStatus = {
  address: Address.Address
  isDeployed: boolean
  implementation?: Address.Address
  configuration: Config.Config
  imageHash: Hex.Hex
  /** Pending updates in reverse chronological order (newest first) */
  pendingUpdates: Array<{ imageHash: Hex.Hex; signature: SequenceSignature.RawSignature }>
  /** Pending migrations, fully encoded with signature */
  pendingMigrations: Array<State.Migration>
  version: number
  chainId?: number
  counterFactual: {
    context: Context.KnownContext | Context.Context
    imageHash: Hex.Hex
  }
}

export type WalletStatusWithOnchain = WalletStatus & {
  onChainImageHash: Hex.Hex
  stage: 'stage1' | 'stage2'
  context: Context.KnownContext | Context.Context
}

export class Wallet {
  public readonly guest: Address.Address
  public readonly stateProvider: State.Provider
  public readonly knownContexts: Context.Context[]

  constructor(
    readonly address: Address.Address,
    options?: Partial<WalletOptions>,
  ) {
    const combinedContexts = [...DefaultWalletOptions.knownContexts, ...(options?.knownContexts ?? [])]
    const combinedOptions = { ...DefaultWalletOptions, ...options, knownContexts: combinedContexts }
    this.guest = combinedOptions.guest
    this.stateProvider = combinedOptions.stateProvider
    this.knownContexts = combinedOptions.knownContexts
  }

  /**
   * Creates a new counter-factual wallet using the provided configuration.
   * Saves the wallet in the state provider, so you can get its imageHash from its address,
   * and its configuration from its imageHash.
   *
   * @param configuration - The wallet configuration to use.
   * @param options - Optional wallet options.
   * @returns A Promise that resolves to the new Wallet instance.
   */
  static async fromConfiguration(
    configuration: Config.Config,
    options?: Partial<WalletOptions> & { context?: Context.Context },
  ): Promise<Wallet> {
    const context = options?.context ?? Context.Dev2
    const merged = { ...DefaultWalletOptions, ...options }

    if (!merged.unsafe) {
      Config.evaluateConfigurationSafety(configuration)
    }

    await merged.stateProvider.saveWallet(configuration, context)
    return new Wallet(SequenceAddress.from(configuration, context), merged)
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

  /**
   * Prepares an envelope for updating the wallet's configuration.
   *
   * This function creates the necessary envelope that must be signed in order to update
   * the configuration of a wallet. If the `unsafe` option is set to true, no sanity checks
   * will be performed on the provided configuration. Otherwise, the configuration will be
   * validated for safety (e.g., weights, thresholds).
   *
   * Note: This function does not directly update the wallet's configuration. The returned
   * envelope must be signed and then submitted using the `submitUpdate` method to apply
   * the configuration change.
   *
   * @param configuration - The new wallet configuration to be proposed.
   * @param options - Options for preparing the update. If `unsafe` is true, skips safety checks.
   * @returns A promise that resolves to an unsigned envelope for the configuration update.
   */
  async prepareUpdate(
    configuration: Config.Config,
    options?: { unsafe?: boolean },
  ): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    if (!options?.unsafe) {
      Config.evaluateConfigurationSafety(configuration)
    }

    const status = await this.getStatus()
    this.requireV3Wallet(status)

    const imageHash = Config.hashConfiguration(configuration)
    const blankEnvelope = (
      await Promise.all([this.prepareBlankEnvelope(0, status), this.stateProvider.saveConfiguration(configuration)])
    )[0]

    return {
      ...blankEnvelope,
      payload: Payload.fromConfigUpdate(Bytes.toHex(imageHash)),
    }
  }

  async submitUpdate(
    envelope: Envelope.Signed<Payload.ConfigUpdate>,
    options?: { noValidateSave?: boolean },
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

    if (!options?.noValidateSave) {
      const status = await this.getStatus()
      if (Hex.from(Config.hashConfiguration(status.configuration)) !== envelope.payload.imageHash) {
        throw new Error('configuration not saved')
      }
    }
  }

  async getStatus<T extends Provider.Provider | undefined = undefined>(
    provider?: T,
  ): Promise<T extends Provider.Provider ? WalletStatusWithOnchain : WalletStatus> {
    let isDeployed = false
    let implementation: Address.Address | undefined
    let chainId: number | undefined
    let imageHash: Hex.Hex
    let updates: Array<{ imageHash: Hex.Hex; signature: SequenceSignature.RawSignature }> = []
    let migrations: Array<State.Migration> = []
    let onChainImageHash: Hex.Hex | undefined
    let stage: 'stage1' | 'stage2' | undefined

    const deployInformation = await this.stateProvider.getDeploy(this.address)
    if (!deployInformation) {
      throw new Error(`cannot find deploy information for ${this.address}`)
    }

    // Try to use a context from the known contexts, so we populate
    // the capabilities of the context
    const counterFactualContext = deployInformation
      ? (this.knownContexts.find(
          (kc) =>
            Address.isEqual(deployInformation.context.factory, kc.factory) &&
            Address.isEqual(deployInformation.context.stage1, kc.stage1),
        ) ?? deployInformation.context)
      : undefined

    let context: Context.KnownContext | Context.Context | undefined

    if (provider) {
      // Get chain ID, deployment status, and implementation
      const requests = await Promise.all([
        provider.request({ method: 'eth_chainId' }).then((res) => Number(res)),
        this.isDeployed(provider),
        provider
          .request({
            method: 'eth_call',
            params: [{ to: this.address, data: AbiFunction.encodeData(Constants.GET_IMPLEMENTATION) }, 'latest'],
          })
          .then((res) => {
            return AbiFunction.decodeResult(Constants.GET_IMPLEMENTATION, res)
          })
          .catch(() => {
            // Fallback to reading storage slot
            const position = AbiParameters.encode(AbiParameters.from(['address']), [this.address])
            return provider
              .request({
                method: 'eth_getStorageAt',
                params: [this.address, position, 'latest'],
              })
              .then((res) => {
                const [implementation] = AbiParameters.decode(AbiParameters.from(['address']), Bytes.fromHex(res))
                const implementationAddress = Address.from(implementation)
                if (Address.isEqual(implementationAddress, '0x0000000000000000000000000000000000000000')) {
                  return undefined
                }
                return implementationAddress
              })
              .catch(() => undefined)
          }),
      ])

      chainId = requests[0]
      isDeployed = requests[1]
      implementation = requests[2]

      // Try to find the context from the known contexts (or use the counterfactual context)
      context = implementation
        ? [...this.knownContexts, counterFactualContext].find(
            (kc) => kc && (Address.isEqual(implementation!, kc.stage1) || Address.isEqual(implementation!, kc.stage2)),
          )
        : counterFactualContext

      if (!context) {
        throw new Error(`cannot find context for ${this.address}`)
      }

      // Determine stage based on implementation address
      stage = implementation && Address.isEqual(implementation, context.stage2) ? 'stage2' : 'stage1'

      // Get image hash and updates
      if (isDeployed && stage === 'stage2') {
        // For deployed stage2 wallets, get the image hash from the contract
        onChainImageHash = await provider.request({
          method: 'eth_call',
          params: [{ to: this.address, data: AbiFunction.encodeData(Constants.IMAGE_HASH) }, 'latest'],
        })
      } else {
        // For non-deployed or stage1 wallets, get the deploy hash
        const deployInformation = await this.stateProvider.getDeploy(this.address)
        if (!deployInformation) {
          throw new Error(`cannot find deploy information for ${this.address}`)
        }
        onChainImageHash = deployInformation.imageHash
      }
    } else if (deployInformation) {
      context = deployInformation.context
    } else {
      throw new Error(`cannot find status information for ${this.address}. Missing deploy information and no provider.`)
    }

    let fromImageHash = onChainImageHash ?? deployInformation.imageHash

    // Get migrations
    const detectedContextVersion = Context.getVersionFromContext(context)
    let version = detectedContextVersion
    if (detectedContextVersion !== 3) {
      // TODO Cater for pending v3 -> v3 migrations
      const migration = await this.stateProvider.getMigration(
        this.address,
        fromImageHash,
        detectedContextVersion,
        chainId ?? 0,
      )
      if (migration) {
        //TODO Support successive migrations
        if (migration.toVersion !== 3) {
          throw new Error(
            `wallet migration is not for v3. Got ${migration.toVersion} for ${this.address} from version ${detectedContextVersion} to version ${migration.toVersion}.`,
          )
        }
        migrations.push(migration)
        // We will perform the migration and update configurations from there.
        fromImageHash = Bytes.toHex(Config.hashConfiguration(migration.toConfig))
        version = migration.toVersion
      }
    }

    // Get configuration updates
    updates = await this.stateProvider.getConfigurationUpdates(this.address, fromImageHash)
    imageHash = updates[updates.length - 1]?.imageHash ?? fromImageHash

    // Get the current configuration
    const configuration = await this.stateProvider.getConfiguration(imageHash)
    if (!configuration) {
      throw new Error(`cannot find configuration details for ${this.address} with image hash ${imageHash}`)
    }

    if (provider) {
      return {
        address: this.address,
        isDeployed,
        implementation,
        stage,
        configuration,
        imageHash,
        pendingUpdates: [...updates].reverse(),
        pendingMigrations: [...migrations],
        version,
        chainId,
        onChainImageHash: onChainImageHash!,
        context,
      } as T extends Provider.Provider ? WalletStatusWithOnchain : WalletStatus
    } else {
      return {
        address: this.address,
        isDeployed,
        implementation,
        configuration,
        imageHash,
        pendingUpdates: [...updates].reverse(),
        pendingMigrations: [...migrations],
        version,
        chainId,
        counterFactual: {
          context: counterFactualContext,
          imageHash: deployInformation?.imageHash ?? '',
        },
      } as T extends Provider.Provider ? WalletStatusWithOnchain : WalletStatus
    }
  }

  async getNonce(provider: Provider.Provider, space: bigint): Promise<bigint> {
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: this.address, data: AbiFunction.encodeData(Constants.READ_NONCE, [space]) }, 'latest'],
    })

    if (result === '0x' || result.length === 0) {
      return 0n
    }

    return BigInt(result)
  }

  async get4337Nonce(provider: Provider.Provider, entrypoint: Address.Address, space: bigint): Promise<bigint> {
    const result = await provider.request({
      method: 'eth_call',
      params: [
        { to: entrypoint, data: AbiFunction.encodeData(Constants.READ_NONCE_4337, [this.address, space]) },
        'latest',
      ],
    })

    if (result === '0x' || result.length === 0) {
      return 0n
    }

    // Mask lower 64 bits
    return BigInt(result) & 0xffffffffffffffffn
  }

  async get4337Entrypoint(provider: Provider.Provider): Promise<Address.Address | undefined> {
    const status = await this.getStatus(provider)
    return status.context.capabilities?.erc4337?.entrypoint
  }

  async prepare4337Transaction(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options: {
      space?: bigint
      noConfigUpdate?: boolean
      unsafe?: boolean
    },
  ): Promise<Envelope.Envelope<Payload.Calls4337_07>> {
    const space = options.space ?? 0n

    // If safe mode is set, then we check that the transaction
    // is not "dangerous", aka it does not have any delegate calls
    // or calls to the wallet contract itself
    if (!options?.unsafe) {
      for (const call of calls) {
        if (call.delegateCall) {
          throw new Error('delegate calls are not allowed in safe mode')
        }
        if (Address.isEqual(call.to, this.address)) {
          throw new Error('calls to the wallet contract itself are not allowed in safe mode')
        }
      }
    }

    const [chainId, status] = await Promise.all([provider.request({ method: 'eth_chainId' }), this.getStatus(provider)])
    this.requireV3Wallet(status, true)

    // If entrypoint is address(0) then 4337 is not enabled in this wallet
    if (!status.context.capabilities?.erc4337?.entrypoint) {
      throw new Error('4337 is not enabled in this wallet')
    }

    const noncePromise = this.get4337Nonce(provider, status.context.capabilities?.erc4337?.entrypoint!, space)

    // If the wallet is not deployed, then we need to include the initCode on
    // the 4337 transaction
    let factory: Address.Address | undefined
    let factoryData: Hex.Hex | undefined

    if (!status.isDeployed) {
      const deploy = await this.buildDeployTransaction()
      factory = deploy.to
      factoryData = deploy.data
    }

    // If the latest configuration does not match the onchain configuration
    // then we bundle the update into the transaction envelope
    if (!options?.noConfigUpdate) {
      const status = await this.getStatus(provider)
      if (status.imageHash !== status.onChainImageHash) {
        calls.push({
          to: this.address,
          value: 0n,
          data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [status.imageHash]),
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        })
      }
    }

    return {
      payload: {
        type: 'call_4337_07',
        nonce: await noncePromise,
        space,
        calls,
        entrypoint: status.context.capabilities?.erc4337?.entrypoint,
        callGasLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: undefined,
        paymasterData: '0x',
        preVerificationGas: 0n,
        verificationGasLimit: 0n,
        factory,
        factoryData,
      },
      ...(await this.prepareBlankEnvelope(Number(chainId), status)),
    }
  }

  async build4337Transaction(
    provider: Provider.Provider,
    envelope: Envelope.Signed<Payload.Calls4337_07>,
  ): Promise<{ operation: UserOperation.RpcV07; entrypoint: Address.Address }> {
    const status = await this.getStatus(provider)

    const updatedEnvelope = { ...envelope, configuration: status.configuration }
    const { weight, threshold } = Envelope.weightOf(updatedEnvelope)
    if (weight < threshold) {
      throw new Error('insufficient weight in envelope')
    }

    const signature = Envelope.encodeSignature(updatedEnvelope)
    const operation = Payload.to4337UserOperation(
      envelope.payload,
      this.address,
      Bytes.toHex(
        SequenceSignature.encodeSignature({
          ...signature,
          suffix: status.pendingUpdates.map(({ signature }) => signature),
        }),
      ),
    )

    return {
      operation: UserOperation.toRpc(operation),
      entrypoint: envelope.payload.entrypoint,
    }
  }

  async prepareTransaction(
    provider: Provider.Provider,
    calls: Payload.Call[],
    options?: {
      space?: bigint
      noConfigUpdate?: boolean
      noMigration?: boolean
      unsafe?: boolean
    },
  ): Promise<Envelope.Envelope<Payload.Calls>> {
    const space = options?.space ?? 0n

    // If safe mode is set, then we check that the transaction
    // is not "dangerous", aka it does not have any delegate calls
    // or calls to the wallet contract itself
    if (!options?.unsafe) {
      for (const call of calls) {
        if (call.delegateCall) {
          throw new Error('delegate calls are not allowed in safe mode')
        }
        if (Address.isEqual(call.to, this.address)) {
          throw new Error('calls to the wallet contract itself are not allowed in safe mode')
        }
      }
    }

    const [chainId, nonce] = await Promise.all([
      provider.request({ method: 'eth_chainId' }),
      this.getNonce(provider, space),
    ])

    // If the latest configuration does not match the onchain configuration, we bundle the update into the transaction envelope
    // Same for pending migrations
    const status = await this.getStatus(provider)
    this.requireV3Wallet(status)

    if (!options?.noConfigUpdate) {
      if (status.imageHash !== status.onChainImageHash) {
        calls.push({
          to: this.address,
          value: 0n,
          data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [status.imageHash]),
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        })
      }
    }

    return {
      payload: {
        type: 'call',
        space,
        nonce,
        calls,
      },
      ...(await this.prepareBlankEnvelope(Number(chainId), status)),
    }
  }

  async buildTransaction(
    provider: Provider.Provider,
    envelope: Envelope.Signed<Payload.Calls>,
  ): Promise<{
    to: Address.Address
    data: Hex.Hex
  }> {
    const status = await this.getStatus(provider)

    const updatedEnvelope = { ...envelope, configuration: status.configuration }
    const { weight, threshold } = Envelope.weightOf(updatedEnvelope)
    if (weight < threshold) {
      throw new Error('insufficient weight in envelope')
    }
    const signature = Envelope.encodeSignature(updatedEnvelope)

    const encodedCalls: {
      to: Address.Address
      data: Hex.Hex
    }[] = []

    // Deployment
    if (!status.isDeployed) {
      const deploy = await this.buildDeployTransaction()
      encodedCalls.push(deploy)
    }

    // Pending migrations
    if (status.pendingMigrations.length > 0) {
      encodedCalls.push(...status.pendingMigrations.map(encodeMigration))
    }

    // Requested payload
    encodedCalls.push({
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
    })

    if (encodedCalls.length === 1) {
      return encodedCalls[0]!
    }

    return {
      to: this.guest,
      data: Bytes.toHex(
        Payload.encode({
          type: 'call',
          space: 0n,
          nonce: 0n,
          calls: encodedCalls.map((call) => ({
            ...call,
            value: 0n,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          })),
        }),
      ),
    }
  }

  async prepareMessageSignature(
    message: string | Hex.Hex | Payload.TypedDataToSign,
    chainId: number,
  ): Promise<Envelope.Envelope<Payload.Message>> {
    let encodedMessage: Hex.Hex
    if (typeof message !== 'string') {
      encodedMessage = TypedData.encode(message)
    } else {
      let hexMessage = Hex.validate(message) ? message : Hex.fromString(message)
      const messageSize = Hex.size(hexMessage)
      encodedMessage = Hex.concat(Hex.fromString(`${`\x19Ethereum Signed Message:\n${messageSize}`}`), hexMessage)
    }
    const status = await this.getStatus()
    this.requireV3Wallet(status, true)

    return {
      ...(await this.prepareBlankEnvelope(chainId, status)),
      payload: Payload.fromMessage(encodedMessage),
    }
  }

  async buildMessageSignature(
    envelope: Envelope.Signed<Payload.Message>,
    provider?: Provider.Provider,
  ): Promise<Bytes.Bytes> {
    const status = await this.getStatus(provider)
    this.requireV3Wallet(status, true)

    const signature = Envelope.encodeSignature(envelope)
    if (!status.isDeployed) {
      const deployTransaction = await this.buildDeployTransaction()
      signature.erc6492 = { to: deployTransaction.to, data: Bytes.fromHex(deployTransaction.data) }
    }
    const encoded = SequenceSignature.encodeSignature({
      ...signature,
      suffix: status.pendingUpdates.map(({ signature }) => signature),
    })
    return encoded
  }

  private prepareBlankEnvelope(chainId: number, status: WalletStatus) {
    return {
      wallet: this.address,
      chainId: chainId,
      configuration: status.configuration,
    }
  }

  private requireV3Wallet(status: WalletStatus, noPendingMigrations: boolean = false): boolean {
    if (status.version !== 3) {
      throw new Error('migrate to v3 before performing this action')
    }
    if (noPendingMigrations && status.pendingMigrations.length > 0) {
      throw new Error('execute pending migrations before performing this action')
    }
    return true
  }
}

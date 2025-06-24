import { Wallet as CoreWallet, Envelope, Signers, State } from '@0xsequence/wallet-core'
import { Config, GenericTree, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider, RpcTransport } from 'ox'
import { AuthCommitment } from '../dbs/auth-commitments.js'
import { MnemonicHandler } from './handlers/mnemonic.js'
import { OtpHandler } from './handlers/otp.js'
import { Shared } from './manager.js'
import { Action } from './types/index.js'
import { Kinds, WitnessExtraSignerKind } from './types/signer.js'
import { Wallet, WalletSelectionUiHandler } from './types/wallet.js'
import { AuthCodeHandler } from './handlers/authcode.js'

export type StartSignUpWithRedirectArgs = {
  kind: 'google-pkce' | 'apple'
  target: string
  metadata: { [key: string]: string }
}

export type CommonSignupArgs = {
  noGuard?: boolean
  noSessionManager?: boolean
  noRecovery?: boolean
}

export type PasskeySignupArgs = CommonSignupArgs & {
  kind: 'passkey'
}

export type MnemonicSignupArgs = CommonSignupArgs & {
  kind: 'mnemonic'
  mnemonic: string
}

export type EmailOtpSignupArgs = CommonSignupArgs & {
  kind: 'email-otp'
  email: string
}

export type CompleteRedirectArgs = CommonSignupArgs & {
  state: string
  code: string
}

export type AuthCodeSignupArgs = CommonSignupArgs & {
  kind: 'google-pkce' | 'apple'
  commitment: AuthCommitment
  code: string
  target: string
  isRedirect: boolean
}

export type SignupArgs = PasskeySignupArgs | MnemonicSignupArgs | EmailOtpSignupArgs | AuthCodeSignupArgs

export type LoginToWalletArgs = {
  wallet: Address.Address
}

export type LoginToMnemonicArgs = {
  kind: 'mnemonic'
  mnemonic: string
  selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>
}

export type LoginToPasskeyArgs = {
  kind: 'passkey'
  selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>
}

export type LoginArgs = LoginToWalletArgs | LoginToMnemonicArgs | LoginToPasskeyArgs

export function isLoginToWalletArgs(args: LoginArgs): args is LoginToWalletArgs {
  return 'wallet' in args
}

export function isLoginToMnemonicArgs(args: LoginArgs): args is LoginToMnemonicArgs {
  return 'kind' in args && args.kind === 'mnemonic'
}

export function isLoginToPasskeyArgs(args: LoginArgs): args is LoginToPasskeyArgs {
  return 'kind' in args && args.kind === 'passkey'
}

export function isAuthCodeArgs(args: SignupArgs): args is AuthCodeSignupArgs {
  return 'kind' in args && (args.kind === 'google-pkce' || args.kind === 'apple')
}

function buildCappedTree(members: { address: Address.Address; imageHash?: Hex.Hex }[]): Config.Topology {
  const loginMemberWeight = 1n

  if (members.length === 0) {
    // We need to maintain the general structure of the tree, so we can't have an empty node here
    // instead, we add a dummy signer with weight 0
    return {
      type: 'signer',
      address: '0x0000000000000000000000000000000000000000',
      weight: 0n,
    } as Config.SignerLeaf
  }

  if (members.length === 1) {
    if (members[0]!.imageHash) {
      return {
        type: 'sapient-signer',
        address: members[0]!.address,
        imageHash: members[0]!.imageHash,
        weight: loginMemberWeight,
      } as Config.SapientSignerLeaf
    } else {
      return {
        type: 'signer',
        address: members[0]!.address,
        weight: loginMemberWeight,
      } as Config.SignerLeaf
    }
  }

  return {
    type: 'nested',
    weight: loginMemberWeight,
    threshold: 1n,
    tree: Config.flatLeavesToTopology(
      members.map((member) =>
        member.imageHash
          ? {
              type: 'sapient-signer',
              address: member.address,
              imageHash: member.imageHash,
              weight: 1n,
            }
          : {
              type: 'signer',
              address: member.address,
              weight: 1n,
            },
      ),
    ),
  } as Config.NestedLeaf
}

function buildCappedTreeFromTopology(weight: bigint, topology: Config.Topology): Config.Topology {
  // We may optimize this for some topology types
  // but it is not worth it, because the topology
  // that we will use for prod won't be optimizable
  return {
    type: 'nested',
    weight: weight,
    threshold: weight,
    tree: topology,
  }
}

function toConfig(
  checkpoint: bigint,
  loginTopology: Config.Topology,
  devicesTopology: Config.Topology,
  modules: Config.SapientSignerLeaf[],
  guardTopology?: Config.Topology,
): Config.Config {
  if (!guardTopology) {
    return {
      checkpoint: checkpoint,
      threshold: 1n,
      topology: [[loginTopology, devicesTopology], toModulesTopology(modules)],
    }
  } else {
    return {
      checkpoint: checkpoint,
      threshold: 2n,
      topology: [[[loginTopology, devicesTopology], guardTopology], toModulesTopology(modules)],
    }
  }
}

function toModulesTopology(modules: Config.SapientSignerLeaf[]): Config.Topology {
  // We always include a modules topology, even if there are no modules
  // in that case we just add a signer with address 0 and no weight
  if (modules.length === 0) {
    return {
      type: 'signer',
      address: '0x0000000000000000000000000000000000000000',
      weight: 0n,
    } as Config.SignerLeaf
  }

  return Config.flatLeavesToTopology(modules)
}

function fromModulesTopology(topology: Config.Topology): Config.SapientSignerLeaf[] {
  let modules: Config.SapientSignerLeaf[] = []

  if (Config.isNode(topology)) {
    modules = [...fromModulesTopology(topology[0]), ...fromModulesTopology(topology[1])]
  } else if (Config.isSapientSignerLeaf(topology)) {
    modules.push(topology)
  } else if (Config.isSignerLeaf(topology)) {
    // This signals that the wallet has no modules, so we just ignore it
    if (topology.address !== '0x0000000000000000000000000000000000000000') {
      throw new Error('signer-leaf-not-allowed-in-modules-topology')
    }
  } else {
    throw new Error('unknown-modules-topology-format')
  }

  return modules
}

function fromConfig(config: Config.Config): {
  loginTopology: Config.Topology
  devicesTopology: Config.Topology
  modules: Config.SapientSignerLeaf[]
  guardTopology?: Config.Topology
} {
  if (config.threshold === 1n) {
    if (Config.isNode(config.topology) && Config.isNode(config.topology[0])) {
      return {
        loginTopology: config.topology[0][0],
        devicesTopology: config.topology[0][1],
        modules: fromModulesTopology(config.topology[1]),
      }
    } else {
      throw new Error('unknown-config-format')
    }
  } else if (config.threshold === 2n) {
    if (Config.isNode(config.topology) && Config.isNode(config.topology[0]) && Config.isNode(config.topology[0][0])) {
      return {
        loginTopology: config.topology[0][0][0],
        devicesTopology: config.topology[0][0][1],
        guardTopology: config.topology[0][1],
        modules: fromModulesTopology(config.topology[1]),
      }
    } else {
      throw new Error('unknown-config-format')
    }
  }

  throw new Error('unknown-config-format')
}

export class Wallets {
  private walletSelectionUiHandler: WalletSelectionUiHandler | null = null

  constructor(private readonly shared: Shared) {}

  public async exists(wallet: Address.Address): Promise<boolean> {
    return this.shared.databases.manager.get(wallet).then((r) => r !== undefined)
  }

  public async get(walletAddress: Address.Address): Promise<Wallet | undefined> {
    return await this.shared.databases.manager.get(walletAddress)
  }

  public async list(): Promise<Wallet[]> {
    return this.shared.databases.manager.list()
  }

  public registerWalletSelector(handler: WalletSelectionUiHandler) {
    if (this.walletSelectionUiHandler) {
      throw new Error('wallet-selector-already-registered')
    }
    this.walletSelectionUiHandler = handler
    return () => {
      this.unregisterWalletSelector(handler)
    }
  }

  public unregisterWalletSelector(handler?: WalletSelectionUiHandler) {
    if (handler && this.walletSelectionUiHandler !== handler) {
      throw new Error('wallet-selector-not-registered')
    }
    this.walletSelectionUiHandler = null
  }

  public onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean) {
    const undo = this.shared.databases.manager.addListener(() => {
      this.list().then((wallets) => {
        cb(wallets)
      })
    })

    if (trigger) {
      this.list().then((wallets) => {
        cb(wallets)
      })
    }

    return undo
  }

  private async prepareSignUp(args: SignupArgs): Promise<{
    signer: (Signers.Signer | Signers.SapientSigner) & Signers.Witnessable
    extra: WitnessExtraSignerKind
    loginEmail?: string
  }> {
    switch (args.kind) {
      case 'passkey':
        const passkeySigner = await Signers.Passkey.Passkey.create(this.shared.sequence.extensions, {
          stateProvider: this.shared.sequence.stateProvider,
        })
        this.shared.modules.logger.log('Created new passkey signer:', passkeySigner.address)

        return {
          signer: passkeySigner,
          extra: {
            signerKind: Kinds.LoginPasskey,
          },
        }

      case 'mnemonic':
        const mnemonicSigner = MnemonicHandler.toSigner(args.mnemonic)
        if (!mnemonicSigner) {
          throw new Error('invalid-mnemonic')
        }

        this.shared.modules.logger.log('Created new mnemonic signer:', mnemonicSigner.address)

        return {
          signer: mnemonicSigner,
          extra: {
            signerKind: Kinds.LoginMnemonic,
          },
        }

      case 'email-otp': {
        const handler = this.shared.handlers.get(Kinds.LoginEmailOtp) as OtpHandler
        if (!handler) {
          throw new Error('email-otp-handler-not-registered')
        }

        const { signer: otpSigner, email: returnedEmail } = await handler.getSigner(args.email)
        this.shared.modules.logger.log('Created new email otp signer:', otpSigner.address, 'Email:', returnedEmail)

        return {
          signer: otpSigner,
          extra: {
            signerKind: Kinds.LoginEmailOtp,
          },
          loginEmail: returnedEmail,
        }
      }

      case 'google-pkce':
      case 'apple': {
        const handler = this.shared.handlers.get('login-' + args.kind) as AuthCodeHandler
        if (!handler) {
          throw new Error('handler-not-registered')
        }

        const [signer, metadata] = await handler.completeAuth(args.commitment, args.code)
        const loginEmail = metadata.email
        this.shared.modules.logger.log('Created new auth code pkce signer:', signer.address)

        return {
          signer,
          extra: {
            signerKind: 'login-' + args.kind,
          },
          loginEmail,
        }
      }
    }
  }

  async startSignUpWithRedirect(args: StartSignUpWithRedirectArgs) {
    const handler = this.shared.handlers.get('login-' + args.kind) as AuthCodeHandler
    if (!handler) {
      throw new Error('handler-not-registered')
    }
    return handler.commitAuth(args.target, true)
  }

  async completeRedirect(args: CompleteRedirectArgs) {
    const commitment = await this.shared.databases.authCommitments.get(args.state)
    if (!commitment) {
      throw new Error('invalid-state')
    }

    if (commitment.isSignUp) {
      await this.signUp({
        kind: commitment.kind,
        commitment,
        code: args.code,
        noGuard: args.noGuard,
        target: commitment.target,
        isRedirect: true,
      })
    } else {
      const handler = this.shared.handlers.get('login-' + commitment.kind) as AuthCodeHandler
      if (!handler) {
        throw new Error('handler-not-registered')
      }

      const [_signer, metadata] = await handler.completeAuth(commitment, args.code)

      const loginEmail = metadata.email

      if (loginEmail && commitment.target) {
        const walletAddress = commitment.target as Address.Address
        const walletEntry = await this.shared.databases.manager.get(walletAddress)

        if (walletEntry) {
          const updatedWalletEntry = {
            ...walletEntry,
            loginEmail,
            loginType: ('login-' + commitment.kind) as Wallet['loginType'],
            loginDate: new Date().toISOString(),
          }

          await this.shared.databases.manager.set(updatedWalletEntry)
        }
      }
    }
    return commitment.target
  }

  async signUp(args: SignupArgs) {
    const loginSigner = await this.prepareSignUp(args)

    // If there is an existing wallet callback, we check if any wallet already exist for this login signer
    if (this.walletSelectionUiHandler) {
      const existingWallets = await State.getWalletsFor(this.shared.sequence.stateProvider, loginSigner.signer)
      if (existingWallets.length > 0) {
        const result = await this.walletSelectionUiHandler({
          existingWallets: existingWallets.map((w) => w.wallet),
          signerAddress: await loginSigner.signer.address,
          context: isAuthCodeArgs(args)
            ? {
                isRedirect: args.isRedirect,
                target: args.target,
              }
            : {
                isRedirect: false,
              },
        })

        if (result) {
          const selectedWalletAddress = result as Address.Address
          const existingWalletEntry = await this.shared.databases.manager.get(selectedWalletAddress)

          if (existingWalletEntry) {
            const updatedWalletEntry = {
              ...existingWalletEntry,
              loginEmail: loginSigner.loginEmail,
              loginType: loginSigner.extra.signerKind as Wallet['loginType'],
              loginDate: new Date().toISOString(),
            }

            await this.shared.databases.manager.set(updatedWalletEntry)
          } else {
            // This case might indicate an inconsistency if the UI handler found a wallet
            // that isn't in the primary manager DB, or if 'result' isn't the address.
            console.warn(
              '[Wallets/signUp] Wallet selected via UI handler not found in manager DB, or result format unexpected. Selected:',
              selectedWalletAddress,
            )
          }
          // Now we can exit early.
          return
        }
      }
    } else {
      console.warn('No wallet selector registered, creating a new wallet')
    }

    // Create the first session
    const device = await this.shared.modules.devices.create()

    if (!args.noGuard && !this.shared.sequence.defaultGuardTopology) {
      throw new Error('guard is required for signup')
    }

    // Build the login tree
    const loginSignerAddress = await loginSigner.signer.address
    const loginTopology = buildCappedTree([
      {
        address: loginSignerAddress,
        imageHash: Signers.isSapientSigner(loginSigner.signer) ? await loginSigner.signer.imageHash : undefined,
      },
    ])
    const devicesTopology = buildCappedTree([{ address: device.address }])
    const guardTopology = args.noGuard
      ? undefined
      : buildCappedTreeFromTopology(1n, this.shared.sequence.defaultGuardTopology)

    // TODO: Add recovery module
    // TODO: Add smart sessions module
    // Placeholder
    let modules: Config.SapientSignerLeaf[] = []

    if (!args.noSessionManager) {
      //  Calculate image hash with the identity signer
      const sessionsTopology = SessionConfig.emptySessionsTopology(loginSignerAddress)
      // Store this tree in the state provider
      const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
      this.shared.sequence.stateProvider.saveTree(sessionsConfigTree)
      // Prepare the configuration leaf
      const sessionsImageHash = GenericTree.hash(sessionsConfigTree)
      modules.push({
        type: 'sapient-signer',
        address: this.shared.sequence.extensions.sessions,
        imageHash: sessionsImageHash,
        weight: 255n,
      })
    }

    if (!args.noRecovery) {
      await this.shared.modules.recovery.initRecoveryModule(modules, device.address)
    }

    // Create initial configuration
    const initialConfiguration = toConfig(0n, loginTopology, devicesTopology, modules, guardTopology)
    console.log('initialConfiguration', initialConfiguration)

    // Create wallet
    const wallet = await CoreWallet.fromConfiguration(initialConfiguration, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    this.shared.modules.logger.log('Created new sequence wallet:', wallet.address)

    // Sign witness using device signer
    await this.shared.modules.devices.witness(device.address, wallet.address)

    // Sign witness using the passkey signer
    await loginSigner.signer.witness(this.shared.sequence.stateProvider, wallet.address, loginSigner.extra)

    // Sign witness using the guard signer
    if (guardTopology) {
      await this.shared.modules.guard.witness(wallet.address)
    }

    // Save entry in the manager db
    const newWalletEntry = {
      address: wallet.address,
      status: 'ready' as const,
      loginDate: new Date().toISOString(),
      device: device.address,
      loginType: loginSigner.extra.signerKind,
      useGuard: !args.noGuard,
      loginEmail: loginSigner.loginEmail,
    }

    try {
      await this.shared.databases.manager.set(newWalletEntry)
    } catch (error) {
      console.error('[Wallets/signUp] Error saving new wallet entry:', error, 'Entry was:', newWalletEntry)
      // Re-throw the error if you want the operation to fail loudly, or handle it
      throw error
    }

    return wallet.address
  }

  public async getConfigurationParts(address: Address.Address) {
    const wallet = new CoreWallet(address, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await wallet.getStatus()
    return fromConfig(status.configuration)
  }

  public async requestConfigurationUpdate(
    address: Address.Address,
    changes: Partial<ReturnType<typeof fromConfig>>,
    action: Action,
    origin?: string,
  ) {
    const wallet = new CoreWallet(address, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await wallet.getStatus()
    const { loginTopology, devicesTopology, modules, guardTopology } = fromConfig(status.configuration)

    const nextLoginTopology = changes.loginTopology ?? loginTopology
    const nextDevicesTopology = changes.devicesTopology ?? devicesTopology
    const nextModules = changes.modules ?? modules
    const nextGuardTopology = changes.guardTopology ?? guardTopology

    const envelope = await wallet.prepareUpdate(
      toConfig(
        status.configuration.checkpoint + 1n,
        nextLoginTopology,
        nextDevicesTopology,
        nextModules,
        nextGuardTopology,
      ),
    )

    const requestId = await this.shared.modules.signatures.request(envelope, action, {
      origin,
    })

    return requestId
  }

  public async completeConfigurationUpdate(requestId: string) {
    const request = await this.shared.modules.signatures.get(requestId)
    if (!Payload.isConfigUpdate(request.envelope.payload)) {
      throw new Error('invalid-request-payload')
    }

    if (!Envelope.reachedThreshold(request.envelope)) {
      throw new Error('insufficient-weight')
    }

    const wallet = new CoreWallet(request.wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    await wallet.submitUpdate(request.envelope as Envelope.Signed<Payload.ConfigUpdate>)
    await this.shared.modules.signatures.complete(requestId)
  }

  async login(args: LoginArgs): Promise<string | undefined> {
    if (isLoginToWalletArgs(args)) {
      const prevWallet = await this.exists(args.wallet)
      if (prevWallet) {
        throw new Error('wallet-already-logged-in')
      }

      const device = await this.shared.modules.devices.create()
      const { devicesTopology, modules, guardTopology } = await this.getConfigurationParts(args.wallet)

      // Witness the wallet
      await this.shared.modules.devices.witness(device.address, args.wallet)

      // Add device to devices topology
      const prevDevices = Config.getSigners(devicesTopology)
      if (prevDevices.sapientSigners.length > 0) {
        throw new Error('found-sapient-signer-in-devices-topology')
      }

      if (!prevDevices.isComplete) {
        throw new Error('devices-topology-incomplete')
      }

      const nextDevicesTopology = buildCappedTree([
        ...prevDevices.signers
          .filter((x) => x !== '0x0000000000000000000000000000000000000000')
          .map((x) => ({ address: x })),
        ...prevDevices.sapientSigners.map((x) => ({ address: x.address, imageHash: x.imageHash })),
        { address: device.address },
      ])

      if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
        await this.shared.modules.recovery.addRecoverySignerToModules(modules, device.address)
      }

      const existingEntry = await this.shared.databases.manager.get(args.wallet)

      const walletEntryToUpdate = {
        ...(existingEntry ?? {}),
        address: args.wallet,
        status: 'logging-in' as const,
        loginDate: new Date().toISOString(),
        device: device.address,
        loginType: 'wallet' as const,
        useGuard: guardTopology !== undefined,
      }

      await this.shared.databases.manager.set(walletEntryToUpdate)

      return this.requestConfigurationUpdate(
        args.wallet,
        {
          devicesTopology: nextDevicesTopology,
          modules,
        },
        'login',
        'wallet-webapp',
      )
    }

    if (isLoginToMnemonicArgs(args)) {
      const mnemonicSigner = MnemonicHandler.toSigner(args.mnemonic)
      if (!mnemonicSigner) {
        throw new Error('invalid-mnemonic')
      }

      const wallets = await State.getWalletsFor(this.shared.sequence.stateProvider, mnemonicSigner)
      if (wallets.length === 0) {
        throw new Error('no-wallets-found')
      }

      const wallet = await args.selectWallet(wallets.map((w) => w.wallet))
      if (!wallets.some((w) => Address.isEqual(w.wallet, wallet))) {
        throw new Error('wallet-not-found')
      }

      return this.login({ wallet })
    }

    if (isLoginToPasskeyArgs(args)) {
      const passkeySigner = await Signers.Passkey.Passkey.find(
        this.shared.sequence.stateProvider,
        this.shared.sequence.extensions,
      )
      if (!passkeySigner) {
        throw new Error('no-passkey-found')
      }

      const wallets = await State.getWalletsFor(this.shared.sequence.stateProvider, passkeySigner)
      if (wallets.length === 0) {
        throw new Error('no-wallets-found')
      }

      const wallet = await args.selectWallet(wallets.map((w) => w.wallet))
      if (!wallets.some((w) => Address.isEqual(w.wallet, wallet))) {
        throw new Error('wallet-not-found')
      }

      return this.login({ wallet })
    }

    throw new Error('invalid-login-args')
  }

  async completeLogin(requestId: string) {
    const request = await this.shared.modules.signatures.get(requestId)

    const walletEntry = await this.shared.databases.manager.get(request.wallet)
    if (!walletEntry) {
      throw new Error('login-for-wallet-not-found')
    }

    await this.completeConfigurationUpdate(requestId)

    await this.shared.databases.manager.set({
      ...walletEntry,
      status: 'ready',
      loginDate: new Date().toISOString(),
    })
  }

  async logout<T extends { skipRemoveDevice?: boolean } | undefined = undefined>(
    wallet: Address.Address,
    options?: T,
  ): Promise<T extends { skipRemoveDevice: true } ? undefined : string> {
    const walletEntry = await this.shared.databases.manager.get(wallet)
    if (!walletEntry) {
      throw new Error('wallet-not-found')
    }

    // Prevent starting logout if already logging out or not ready
    if (walletEntry.status !== 'ready') {
      console.warn(`Logout called on wallet ${wallet} with status ${walletEntry.status}. Aborting.`)
      throw new Error(`Wallet is not in 'ready' state for logout (current: ${walletEntry.status})`)
    }

    if (options?.skipRemoveDevice) {
      await Promise.all([
        this.shared.databases.manager.del(wallet),
        this.shared.modules.devices.remove(walletEntry.device),
      ])
      return undefined as any
    }

    const device = await this.shared.modules.devices.get(walletEntry.device)
    if (!device) {
      throw new Error('device-not-found')
    }

    const { devicesTopology, modules } = await this.getConfigurationParts(wallet)
    const nextDevicesTopology = buildCappedTree([
      ...Config.getSigners(devicesTopology)
        .signers.filter((x) => x !== '0x0000000000000000000000000000000000000000' && x !== device.address)
        .map((x) => ({ address: x })),
      ...Config.getSigners(devicesTopology).sapientSigners,
    ])

    // Remove device from the recovery topology, if it exists
    if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
      await this.shared.modules.recovery.removeRecoverySignerFromModules(modules, device.address)
    }

    const requestId = await this.requestConfigurationUpdate(
      wallet,
      {
        devicesTopology: nextDevicesTopology,
        modules,
      },
      'logout',
      'wallet-webapp',
    )

    await this.shared.databases.manager.set({ ...walletEntry, status: 'logging-out' })

    return requestId as any
  }

  async completeLogout(requestId: string, options?: { skipValidateSave?: boolean }) {
    const request = await this.shared.modules.signatures.get(requestId)
    const walletEntry = await this.shared.databases.manager.get(request.wallet)
    if (!walletEntry) {
      throw new Error('wallet-not-found')
    }

    // Wallet entry should ideally be 'logging-out' here, but we proceed regardless
    if (walletEntry.status !== 'logging-out') {
      this.shared.modules.logger.log(
        `Warning: Wallet ${request.wallet} status was ${walletEntry.status} during completeLogout.`,
      )
    }

    await this.completeConfigurationUpdate(requestId)
    await this.shared.databases.manager.del(request.wallet)
    await this.shared.modules.devices.remove(walletEntry.device)
  }

  async getConfiguration(wallet: Address.Address) {
    const walletObject = new CoreWallet(wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await walletObject.getStatus()
    const raw = fromConfig(status.configuration)

    const deviceSigners = Config.getSigners(raw.devicesTopology)
    const loginSigners = Config.getSigners(raw.loginTopology)

    const guardSigners = raw.guardTopology ? Config.getSigners(raw.guardTopology) : undefined

    return {
      devices: await this.shared.modules.signers.resolveKinds(wallet, [
        ...deviceSigners.signers,
        ...deviceSigners.sapientSigners,
      ]),
      login: await this.shared.modules.signers.resolveKinds(wallet, [
        ...loginSigners.signers,
        ...loginSigners.sapientSigners,
      ]),
      guard: guardSigners
        ? await this.shared.modules.signers.resolveKinds(wallet, [
            ...guardSigners.signers,
            ...guardSigners.sapientSigners,
          ])
        : [],
      raw,
    }
  }

  async getNonce(chainId: bigint, address: Address.Address, space: bigint) {
    const wallet = new CoreWallet(address, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpc))
    return wallet.getNonce(provider, space)
  }

  async getOnchainConfiguration(wallet: Address.Address, chainId: bigint) {
    const walletObject = new CoreWallet(wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpc))
    const status = await walletObject.getStatus(provider)

    const onchainConfiguration = await this.shared.sequence.stateProvider.getConfiguration(status.onChainImageHash)
    if (!onchainConfiguration) {
      throw new Error('onchain-configuration-not-found')
    }

    const raw = fromConfig(status.configuration)

    const deviceSigners = Config.getSigners(raw.devicesTopology)
    const loginSigners = Config.getSigners(raw.loginTopology)

    const guardSigners = raw.guardTopology ? Config.getSigners(raw.guardTopology) : undefined

    return {
      devices: await this.shared.modules.signers.resolveKinds(wallet, [
        ...deviceSigners.signers,
        ...deviceSigners.sapientSigners,
      ]),
      login: await this.shared.modules.signers.resolveKinds(wallet, [
        ...loginSigners.signers,
        ...loginSigners.sapientSigners,
      ]),
      guard: guardSigners
        ? await this.shared.modules.signers.resolveKinds(wallet, [
            ...guardSigners.signers,
            ...guardSigners.sapientSigners,
          ])
        : [],
      raw,
    }
  }

  async isUpdatedOnchain(wallet: Address.Address, chainId: bigint) {
    const walletObject = new CoreWallet(wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpc))
    const onchainStatus = await walletObject.getStatus(provider)
    return onchainStatus.imageHash === onchainStatus.onChainImageHash
  }
}

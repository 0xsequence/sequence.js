import { Wallet as CoreWallet, Envelope, Signers, State } from '@0xsequence/wallet-core'
import { Config, GenericTree, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { AuthCommitment } from '../dbs/auth-commitments.js'
import { AuthCodePkceHandler } from './handlers/authcode-pkce.js'
import { MnemonicHandler } from './handlers/mnemonic.js'
import { OtpHandler } from './handlers/otp.js'
import { Shared } from './manager.js'
import { Wallet } from './types/wallet.js'
import { Kinds, WitnessExtraSignerKind } from './types/signer.js'
import { WalletSelectionUiHandler } from './types/wallet.js'

export type StartSignUpWithRedirectArgs = {
  kind: 'google-pkce' | 'apple-pkce'
  target: string
  metadata: { [key: string]: string }
}

export type CommonSignupArgs = {
  noGuard?: boolean
  noSessionManager?: boolean
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

export type AuthCodePkceSignupArgs = CommonSignupArgs & {
  kind: 'google-pkce' | 'apple-pkce'
  commitment: AuthCommitment
  code: string
  target: string
  isRedirect: boolean
}

export type SignupArgs = PasskeySignupArgs | MnemonicSignupArgs | EmailOtpSignupArgs | AuthCodePkceSignupArgs

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

export type SignupResult =
  | {
      type: 'signup'
      wallet: Address.Address
    }
  | {
      type: 'login'
      wallet: Address.Address
      requestId: string
    }

export function isLoginToWalletArgs(args: LoginArgs): args is LoginToWalletArgs {
  return 'wallet' in args
}

export function isLoginToMnemonicArgs(args: LoginArgs): args is LoginToMnemonicArgs {
  return 'kind' in args && args.kind === 'mnemonic'
}

export function isLoginToPasskeyArgs(args: LoginArgs): args is LoginToPasskeyArgs {
  return 'kind' in args && args.kind === 'passkey'
}

export function isAuthCodePkceArgs(args: SignupArgs): args is AuthCodePkceSignupArgs {
  return 'kind' in args && (args.kind === 'google-pkce' || args.kind === 'apple-pkce')
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
  modules: Config.Topology,
  guardTopology?: Config.Topology,
): Config.Config {
  if (!guardTopology) {
    return {
      checkpoint: checkpoint,
      threshold: 1n,
      topology: [[loginTopology, devicesTopology], modules],
    }
  } else {
    return {
      checkpoint: checkpoint,
      threshold: 2n,
      topology: [[[loginTopology, devicesTopology], guardTopology], modules],
    }
  }
}

function fromConfig(config: Config.Config): {
  loginTopology: Config.Topology
  devicesTopology: Config.Topology
  modules: Config.Topology
  guardTopology?: Config.Topology
} {
  if (config.threshold === 1n) {
    if (Config.isNode(config.topology) && Config.isNode(config.topology[0])) {
      return {
        loginTopology: config.topology[0][0],
        devicesTopology: config.topology[0][1],
        modules: config.topology[1],
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
        modules: config.topology[1],
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

        const signer = await handler.getSigner(args.email)
        this.shared.modules.logger.log('Created new email otp signer:', signer.address)

        return {
          signer,
          extra: {
            signerKind: Kinds.LoginEmailOtp,
          },
        }
      }

      case 'google-pkce':
      case 'apple-pkce': {
        const handler = this.shared.handlers.get('login-' + args.kind) as AuthCodePkceHandler
        if (!handler) {
          throw new Error('handler-not-registered')
        }

        const [signer, metadata] = await handler.completeAuth(args.commitment, args.code)
        this.shared.modules.logger.log('Created new auth code pkce signer:', signer.address)

        return {
          signer,
          extra: {
            signerKind: 'login-' + args.kind,
          },
        }
      }
    }
  }

  async startSignUpWithRedirect(args: StartSignUpWithRedirectArgs) {
    const handler = this.shared.handlers.get('login-' + args.kind) as AuthCodePkceHandler
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
      const result = await this.signUp({
        kind: commitment.kind,
        commitment,
        code: args.code,
        noGuard: args.noGuard,
        target: commitment.target,
        isRedirect: true,
      })
    } else {
      const handler = this.shared.handlers.get('login-' + commitment.kind) as AuthCodePkceHandler
      if (!handler) {
        throw new Error('handler-not-registered')
      }

      await handler.completeAuth(commitment, args.code)
    }
    return commitment.target
  }

  async signUp(args: SignupArgs): Promise<SignupResult> {
    const loginSigner = await this.prepareSignUp(args)

    // If there is an existing wallet callback, we check if any wallet already exist for this login signer
    if (this.walletSelectionUiHandler) {
      const existingWallets = await State.getWalletsFor(this.shared.sequence.stateProvider, loginSigner.signer)
      if (existingWallets.length > 0) {
        const selectedWallet = await this.walletSelectionUiHandler({
          existingWallets: existingWallets.map((w) => w.wallet),
          signerAddress: await loginSigner.signer.address,
          context: isAuthCodePkceArgs(args)
            ? {
                isRedirect: args.isRedirect,
                target: args.target,
              }
            : {
                isRedirect: false,
              },
        })

        if (selectedWallet && existingWallets.some((wallet) => wallet.wallet === selectedWallet)) {
          // If a wallet was selected, we login to it
          const requestId = await this.login({
            wallet: selectedWallet,
          })

          return {
            type: 'login',
            wallet: selectedWallet,
            requestId,
          }
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
    let modules: Config.Topology = {
      type: 'signer',
      address: '0x0000000000000000000000000000000000000000',
      weight: 0n,
    }
    if (!args.noSessionManager) {
      //  Calculate image hash with the identity signer
      const sessionsTopology = SessionConfig.emptySessionsTopology(loginSignerAddress)
      // Store this tree in the state provider
      const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
      this.shared.sequence.stateProvider.saveTree(sessionsConfigTree)
      // Prepare the configuration leaf
      const sessionsImageHash = GenericTree.hash(sessionsConfigTree)
      modules = [
        {
          ...this.shared.sequence.defaultSessionsTopology,
          imageHash: sessionsImageHash,
        },
        modules,
      ]
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

    // Save entry in the manager db
    await this.shared.databases.manager.set({
      address: wallet.address,
      status: 'ready',
      loginDate: new Date().toISOString(),
      device: device.address,
      loginType: loginSigner.extra.signerKind,
      useGuard: !args.noGuard,
    })

    return { type: 'signup', wallet: wallet.address }
  }

  async login(args: LoginArgs): Promise<string> {
    if (isLoginToWalletArgs(args)) {
      const prevWallet = await this.exists(args.wallet)
      if (prevWallet) {
        throw new Error('wallet-already-logged-in')
      }

      const wallet = new CoreWallet(args.wallet, {
        context: this.shared.sequence.context,
        stateProvider: this.shared.sequence.stateProvider,
        guest: this.shared.sequence.guest,
      })

      const device = await this.shared.modules.devices.create()
      const status = await wallet.getStatus()

      const { loginTopology, devicesTopology, modules, guardTopology } = fromConfig(status.configuration)

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
      const envelope = await wallet.prepareUpdate(
        toConfig(status.configuration.checkpoint + 1n, loginTopology, nextDevicesTopology, modules, guardTopology),
      )

      const requestId = await this.shared.modules.signatures.request(envelope, 'login', {
        origin: 'wallet-webapp',
      })

      await this.shared.modules.devices.witness(device.address, wallet.address)

      await this.shared.databases.manager.set({
        address: wallet.address,
        status: 'logging-in',
        loginDate: new Date().toISOString(),
        device: device.address,
        loginType: 'wallet',
        useGuard: guardTopology !== undefined,
      })

      return requestId
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
      if (!wallets.some((w) => w.wallet === wallet)) {
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
      if (!wallets.some((w) => w.wallet === wallet)) {
        throw new Error('wallet-not-found')
      }

      return this.login({ wallet })
    }

    throw new Error('invalid-login-args')
  }

  async completeLogin(requestId: string) {
    const request = await this.shared.modules.signatures.get(requestId)

    const envelope = request.envelope
    if (!Payload.isConfigUpdate(envelope.payload)) {
      throw new Error('invalid-request-payload')
    }

    if (!Envelope.reachedThreshold(envelope)) {
      throw new Error('insufficient-weight')
    }

    const walletEntry = await this.shared.databases.manager.get(request.wallet)
    if (!walletEntry) {
      throw new Error('login-for-wallet-not-found')
    }

    const wallet = new CoreWallet(request.wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    await wallet.submitUpdate(envelope as Envelope.Signed<Payload.ConfigUpdate>)
    await this.shared.modules.signatures.complete(requestId)

    // Save entry in the manager db
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

    const walletObj = new CoreWallet(wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await walletObj.getStatus()
    const { loginTopology, devicesTopology, modules, guardTopology } = fromConfig(status.configuration)

    const nextDevicesTopology = buildCappedTree([
      ...Config.getSigners(devicesTopology)
        .signers.filter((x) => x !== '0x0000000000000000000000000000000000000000' && x !== device.address)
        .map((x) => ({ address: x })),
      ...Config.getSigners(devicesTopology).sapientSigners,
    ])

    console.log('nextDevicesTopology', nextDevicesTopology)

    const envelope = await walletObj.prepareUpdate(
      toConfig(status.configuration.checkpoint + 1n, loginTopology, nextDevicesTopology, modules, guardTopology),
    )

    const requestId = await this.shared.modules.signatures.request(envelope, 'logout', {
      origin: 'wallet-webapp',
    })

    return requestId as any
  }

  async completeLogout(requestId: string, options?: { skipValidateSave?: boolean }) {
    const request = await this.shared.modules.signatures.get(requestId)
    if (!Payload.isConfigUpdate(request.envelope.payload)) {
      throw new Error('invalid-request-payload')
    }

    const walletEntry = await this.shared.databases.manager.get(request.wallet)
    if (!walletEntry) {
      throw new Error('wallet-not-found')
    }

    const wallet = new CoreWallet(request.wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    await wallet.submitUpdate(request.envelope as Envelope.Signed<Payload.ConfigUpdate>, {
      validateSave: !options?.skipValidateSave,
    })

    await this.shared.modules.signatures.complete(requestId)
    await this.shared.databases.manager.del(request.wallet)
    await this.shared.modules.devices.remove(walletEntry.device)
  }

  async getConfiguration(args: { wallet: Address.Address }) {
    const wallet = new CoreWallet(args.wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await wallet.getStatus()
    const { devicesTopology, loginTopology } = fromConfig(status.configuration)

    const deviceSigners = Config.getSigners(devicesTopology)
    const loginSigners = Config.getSigners(loginTopology)

    return {
      devices: await this.shared.modules.signers.resolveKinds(wallet.address, [
        ...deviceSigners.signers,
        ...deviceSigners.sapientSigners,
      ]),
      login: await this.shared.modules.signers.resolveKinds(wallet.address, [
        ...loginSigners.signers,
        ...loginSigners.sapientSigners,
      ]),
    }
  }
}

import { Wallet as CoreWallet, Envelope, Signers, State } from '@0xsequence/wallet-core'
import { Config, Constants, GenericTree, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider, RpcTransport } from 'ox'
import { AuthCommitment } from '../dbs/auth-commitments.js'
import { AuthCodeHandler } from './handlers/authcode.js'
import { MnemonicHandler } from './handlers/mnemonic.js'
import { OtpHandler } from './handlers/otp.js'
import { ManagerOptionsDefaults, Shared } from './manager.js'
import { Device } from './types/device.js'
import { Action, Module } from './types/index.js'
import { Kinds, SignerWithKind, WitnessExtraSignerKind } from './types/signer.js'
import { Wallet, WalletSelectionUiHandler } from './types/wallet.js'
import { PasskeyLoginOptimizer } from './passkey-login-optimizer.js'

export type StartSignUpWithRedirectArgs = {
  kind: 'google-pkce' | 'apple'
  target: string
  metadata: { [key: string]: string }
}

export type SignupStatus =
  | { type: 'login-signer-created'; address: Address.Address }
  | { type: 'device-signer-created'; address: Address.Address }
  | { type: 'wallet-created'; address: Address.Address }
  | { type: 'signup-completed' }
  | { type: 'signup-aborted' }

export type CommonSignupArgs = {
  use4337?: boolean
  noGuard?: boolean
  noSessionManager?: boolean
  noRecovery?: boolean
  onStatusChange?: (status: SignupStatus) => void
}

export type PasskeySignupArgs = CommonSignupArgs & {
  kind: 'passkey'
  name?: string
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

export interface WalletsInterface {
  /**
   * Checks if a wallet is currently managed and logged in within this manager instance.
   *
   * This method queries the local database to see if there is an active session for the given wallet address.
   * It's important to note that a `false` return value does not mean the wallet doesn't exist on-chain;
   * it simply means this specific browser/device does not have a logged-in session for it.
   *
   * @param wallet The address of the wallet to check.
   * @returns A promise that resolves to `true` if the wallet is managed, `false` otherwise.
   */
  has(wallet: Address.Address): Promise<boolean>

  /**
   * Retrieves the details of a managed wallet.
   *
   * This method returns the stored `Wallet` object, which contains information about the session,
   * such as its status (`ready`, `logging-in`, `logging-out`), the device address used for this session,
   * the login method (`mnemonic`, `passkey`, etc.), and the login date.
   *
   * @param walletAddress The address of the wallet to retrieve.
   * @returns A promise that resolves to the `Wallet` object if found, or `undefined` if the wallet is not managed.
   * @see {Wallet} for details on the returned object structure.
   */
  get(walletAddress: Address.Address): Promise<Wallet | undefined>

  /**
   * Lists all wallets that are currently managed and logged in by this manager instance.
   *
   * @returns A promise that resolves to an array of `Wallet` objects.
   */
  list(): Promise<Wallet[]>

  /**
   * Lists all device keys currently authorized in the wallet's on-chain configuration.
   *
   * This method inspects the wallet's configuration to find all signers that
   * have been identified as 'local-device' keys. It also indicates which of
   * these keys corresponds to the current, active session.
   *
   * @param wallet The address of the wallet to query.
   * @returns A promise that resolves to an array of `Device` objects.
   */
  listDevices(wallet: Address.Address): Promise<Device[]>

  /**
   * Registers a UI handler for wallet selection.
   *
   * Some authentication methods (like emails or social logins) can be associated with multiple wallets.
   * When a user attempts to sign up with a credential that already has wallets, this handler is invoked
   * to prompt the user to either select an existing wallet to log into or confirm the creation of a new one.
   *
   * If no handler is registered, the system will default to creating a new wallet.
   * Only one handler can be registered per manager instance.
   *
   * @param handler A function that receives `WalletSelectionOptions` and prompts the user for a decision.
   * It should return the address of the selected wallet, or `undefined` to proceed with new wallet creation.
   * @returns A function to unregister the provided handler.
   */
  registerWalletSelector(handler: WalletSelectionUiHandler): () => void

  /**
   * Unregisters the currently active wallet selection UI handler.
   *
   * @param handler (Optional) If provided, it will only unregister if the given handler is the one currently registered.
   * This prevents accidentally unregistering a handler set by another part of the application.
   */
  unregisterWalletSelector(handler?: WalletSelectionUiHandler): void

  /**
   * Subscribes to updates for the list of managed wallets.
   *
   * The provided callback function is invoked whenever a wallet is added (login), removed (logout),
   * or has its status updated (e.g., from 'logging-in' to 'ready').
   *
   * @param cb The callback function to execute with the updated list of wallets.
   * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current list of wallets upon registration.
   * @returns A function to unsubscribe the listener.
   */
  onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean): () => void

  /**
   * Creates and configures a new Sequence wallet.
   *
   * This method manages the full sign-up process, including generating a login signer, creating a device key,
   * building the wallet's on-chain configuration, deploying the wallet, and storing the session locally.
   *
   * If a wallet selection UI handler is registered, it will be invoked if the provided credential is already associated
   * with one or more existing wallets. The handler can return:
   *   - `'create-new'`: The sign-up process continues and a new wallet is created. The method resolves to the new wallet address.
   *   - `'abort-signup'`: The sign-up process is cancelled and the method returns `undefined`. To log in to an existing wallet,
   *     the client must call the `login` method separately with the desired wallet address.
   * If no handler is registered, a new wallet is always created.
   *
   * @param args The sign-up arguments, specifying the method and options.
   *   - `kind: 'mnemonic'`: Uses a mnemonic phrase as the login credential.
   *   - `kind: 'passkey'`: Prompts the user to create a WebAuthn passkey.
   *   - `kind: 'email-otp'`: Initiates an OTP flow to the user's email.
   *   - `kind: 'google-pkce' | 'apple'`: Completes an OAuth redirect flow.
   *   Common options like `noGuard` or `noRecovery` can customize the wallet's security features.
   * @returns A promise that resolves to the address of the newly created wallet, or `undefined` if the sign-up was aborted.
   * @see {SignupArgs}
   */
  signUp(args: SignupArgs): Promise<Address.Address | undefined>

  /**
   * Initiates a sign-up or login process that involves an OAuth redirect.
   *
   * This is the first step for social logins (e.g., Google, Apple). It generates the necessary
   * challenges and state, stores them locally, and returns a URL. Your application should
   * redirect the user to this URL to continue the authentication process with the third-party provider.
   *
   * @param args Arguments specifying the provider (`kind`) and the `target` URL for the provider to redirect back to.
   * @returns A promise that resolves to the full OAuth URL to which the user should be redirected.
   * @see {completeRedirect} for the second step of this flow.
   */
  startSignUpWithRedirect(args: StartSignUpWithRedirectArgs): Promise<string>

  /**
   * Completes an OAuth redirect flow after the user returns to the application.
   *
   * After the user authenticates with the third-party provider and is redirected back, your application
   * must call this method with the `state` and `code` parameters from the URL query string.
   * This method verifies the state, exchanges the code for a token, and completes the sign-up or login process.
   *
   * @param args The arguments containing the `state` and `code` from the redirect, along with original sign-up options.
   * @returns A promise that resolves to target path that should be redirected to.
   */
  completeRedirect(args: CompleteRedirectArgs): Promise<string>

  /**
   * Initiates the login process for an existing wallet by adding the current device as a new signer.
   *
   * This method is for adding a new device/session to a wallet that has already been created. It generates a
   * configuration update transaction to add the new device key to the wallet's on-chain topology.
   * This configuration change requires a signature from an existing authorized signer.
   *
   * The `args` can be one of:
   * - `LoginToWalletArgs`: Login to a known wallet address.
   * - `LoginToMnemonicArgs` / `LoginToPasskeyArgs`: "Discover" wallets associated with a credential,
   *   prompt the user to select one via the `selectWallet` callback, and then log in.
   *
   * @param args The login arguments.
   * @returns A promise that resolves to a `requestId`. This ID represents the signature request for the
   *          configuration update, which must be signed by an existing key to authorize the new device.
   * @see {completeLogin}
   */
  login(args: LoginArgs): Promise<string>

  /**
   * Completes the login process after the configuration update has been signed.
   *
   * After `login` is called and the resulting signature request is fulfilled, this method should be called
   * with the `requestId`. It submits the signed configuration update to the key tracker, finalizing the
   * addition of the new device. The wallet's local status is then set to 'ready'.
   *
   * @param requestId The ID of the completed signature request returned by `login`.
   * @returns A promise that resolves when the login process is fully complete and the wallet is ready for use.
   */
  completeLogin(requestId: string): Promise<void>

  /**
   * Logs out from a given wallet, ending the current session.
   *
   * This method has two modes of operation:
   * 1. **Hard Logout (default):** Initiates a key tracker update to remove the current device's key
   *    from the wallet's configuration. This is the most secure option as it revokes the key's access
   *    entirely. This returns a `requestId` that must be signed and completed via `completeLogout`.
   * 2. **Soft Logout (`skipRemoveDevice: true`):** Immediately deletes the session and device key from local
   *    storage only. This is faster as it requires no transaction, but the device key remains authorized.
   *    This is suitable for clearing a session on a trusted device without revoking the key itself.
   *
   * @param wallet The address of the wallet to log out from.
   * @param options (Optional) Configuration for the logout process.
   * @returns If `skipRemoveDevice` is `true`, returns `Promise<undefined>`. Otherwise, returns a `Promise<string>`
   *          containing the `requestId` for the on-chain logout transaction.
   */
  logout<T extends { skipRemoveDevice?: boolean } | undefined = undefined>(
    wallet: Address.Address,
    options?: T,
  ): Promise<T extends { skipRemoveDevice: true } ? undefined : string>

  /**
   * Initiates a remote logout process for a given wallet.
   *
   * This method is used to log out a device from a wallet that is not the local device.
   *
   * @param wallet The address of the wallet to log out from.
   * @param deviceAddress The address of the device to log out.
   * @returns A promise that resolves to a `requestId` for the on-chain logout transaction.
   */
  remoteLogout(wallet: Address.Address, deviceAddress: Address.Address): Promise<string>

  /**
   * Completes the "hard logout" process.
   *
   * If `logout` was called without `skipRemoveDevice: true`, the resulting configuration update must be signed.
   * Once signed, this method takes the `requestId`, broadcasts the transaction to the network, and upon completion,
   * removes all local data associated with the wallet and device.
   *
   * @param requestId The ID of the completed signature request returned by `logout`.
   * @param options (Optional) Advanced options for completing the logout.
   * @returns A promise that resolves when the on-chain update is submitted and local storage is cleared.
   */
  completeLogout(requestId: string, options?: { skipValidateSave?: boolean }): Promise<void>

  /**
   * Completes a generic configuration update after it has been signed.
   *
   * This method takes a requestId for any action that results in a configuration
   * update (e.g., from `login`, `logout`, `remoteLogout`, `addSigner`, etc.),
   * validates it, and saves the new configuration to the state provider. The
   * update will be bundled with the next on-chain transaction.
   *
   * @param requestId The ID of the completed signature request.
   * @returns A promise that resolves when the update has been processed.
   */
  completeConfigurationUpdate(requestId: string): Promise<void>

  /**
   * Retrieves the full, resolved configuration of a wallet.
   *
   * This method provides a detailed view of the wallet's structure, including lists of
   * login signers and device signers with their "kind" (e.g., 'local-device', 'login-passkey') resolved.
   * It also includes the raw, low-level configuration topology.
   *
   * @param wallet The address of the wallet.
   * @returns A promise that resolves to an object containing the resolved `devices`, `login` signers, and the `raw` configuration.
   */
  getConfiguration(wallet: Address.Address): Promise<{
    devices: SignerWithKind[]
    login: SignerWithKind[]
    guard?: SignerWithKind
    raw: any
  }>

  /**
   * Fetches the current nonce of a wallet for a specific transaction space.
   *
   * Sequence wallets use a 2D nonce system (`space`, `nonce`) to prevent replay attacks and allow
   * for concurrent transactions. This method reads the current nonce for a given space directly from the blockchain.
   *
   * @param chainId The chain ID of the network to query.
   * @param address The address of the wallet.
   * @param space A unique identifier for a transaction category or flow, typically a large random number.
   * @returns A promise that resolves to the `bigint` nonce for the given space.
   */
  getNonce(chainId: number, address: Address.Address, space: bigint): Promise<bigint>

  /**
   * Checks if the wallet's on-chain configuration is up to date for a given chain.
   *
   * This method returns `true` if, on the specified chain, there are no pending configuration updates
   * in the state tracker that have not yet been applied to the wallet. In other words, it verifies
   * that the wallet's on-chain image hash matches the latest configuration image hash.
   *
   * @param wallet The address of the wallet to check.
   * @param chainId The chain ID of the network to check against.
   * @returns A promise that resolves to `true` if the wallet is up to date on the given chain, or `false` otherwise.
   */
  isUpdatedOnchain(wallet: Address.Address, chainId: number): Promise<boolean>
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
      address: Constants.ZeroAddress,
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
  modules: Module[],
  guardTopology?: Config.NestedLeaf,
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

function toModulesTopology(modules: Module[]): Config.Topology {
  // We always include a modules topology, even if there are no modules
  // in that case we just add a signer with address 0 and no weight
  if (modules.length === 0) {
    return {
      type: 'signer',
      address: Constants.ZeroAddress,
      weight: 0n,
    } as Config.SignerLeaf
  }

  const leaves = modules.map((module) => {
    if (module.guardLeaf) {
      return {
        type: 'nested',
        weight: module.weight,
        threshold: module.sapientLeaf.weight + module.guardLeaf.weight,
        tree: [module.sapientLeaf, module.guardLeaf],
      } as Config.NestedLeaf
    } else {
      return module.sapientLeaf
    }
  })

  return Config.flatLeavesToTopology(leaves)
}

function fromModulesTopology(topology: Config.Topology): Module[] {
  let modules: Module[] = []

  if (Config.isNode(topology)) {
    modules = [...fromModulesTopology(topology[0]), ...fromModulesTopology(topology[1])]
  } else if (Config.isSapientSignerLeaf(topology)) {
    modules.push({
      sapientLeaf: topology,
      weight: topology.weight,
    })
  } else if (
    Config.isNestedLeaf(topology) &&
    Config.isNode(topology.tree) &&
    Config.isSapientSignerLeaf(topology.tree[0]) &&
    Config.isNestedLeaf(topology.tree[1])
  ) {
    modules.push({
      sapientLeaf: topology.tree[0],
      weight: topology.weight,
      guardLeaf: topology.tree[1],
    })
  } else if (Config.isSignerLeaf(topology)) {
    // Ignore non-sapient signers, as they are not modules
    return []
  } else {
    throw new Error('unknown-modules-topology-format')
  }

  return modules
}

function fromConfig(config: Config.Config): {
  loginTopology: Config.Topology
  devicesTopology: Config.Topology
  modules: Module[]
  guardTopology?: Config.NestedLeaf
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
    if (
      Config.isNode(config.topology) &&
      Config.isNode(config.topology[0]) &&
      Config.isNode(config.topology[0][0]) &&
      Config.isNestedLeaf(config.topology[0][1])
    ) {
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

export class Wallets implements WalletsInterface {
  private walletSelectionUiHandler: WalletSelectionUiHandler | null = null

  private pendingMnemonicOrPasskeyLogin?: typeof Kinds.LoginMnemonic | typeof Kinds.LoginPasskey

  constructor(private readonly shared: Shared) {}

  public async has(wallet: Address.Address): Promise<boolean> {
    return this.shared.databases.manager.get(wallet).then((r) => r !== undefined)
  }

  public async get(walletAddress: Address.Address): Promise<Wallet | undefined> {
    return await this.shared.databases.manager.get(walletAddress)
  }

  public async list(): Promise<Wallet[]> {
    return this.shared.databases.manager.list()
  }

  public async listDevices(wallet: Address.Address): Promise<Device[]> {
    const walletEntry = await this.get(wallet)
    if (!walletEntry) {
      throw new Error('wallet-not-found')
    }

    const localDeviceAddress = walletEntry.device

    const { devices: deviceSigners } = await this.getConfiguration(wallet)

    return deviceSigners.map((signer) => ({
      address: signer.address,
      isLocal: Address.isEqual(signer.address, localDeviceAddress),
    }))
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
          credentialName: args.name,
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

  async completeRedirect(args: CompleteRedirectArgs): Promise<string> {
    const commitment = await this.shared.databases.authCommitments.get(args.state)
    if (!commitment) {
      throw new Error('invalid-state')
    }

    // commitment.isSignUp and signUp also mean 'signIn' from wallet's perspective
    if (commitment.isSignUp) {
      await this.signUp({
        kind: commitment.kind,
        commitment,
        code: args.code,
        noGuard: args.noGuard,
        target: commitment.target,
        isRedirect: true,
        use4337: args.use4337,
      })
    } else {
      const handler = this.shared.handlers.get('login-' + commitment.kind) as AuthCodeHandler
      if (!handler) {
        throw new Error('handler-not-registered')
      }

      await handler.completeAuth(commitment, args.code)
    }

    if (!commitment.target) {
      throw new Error('invalid-state')
    }

    return commitment.target
  }

  async signUp(args: SignupArgs): Promise<Address.Address | undefined> {
    const loginSigner = await this.prepareSignUp(args)

    args.onStatusChange?.({ type: 'login-signer-created', address: await loginSigner.signer.address })

    // If there is an existing wallet callback, we check if any wallet already exist for this login signer
    if (this.walletSelectionUiHandler) {
      const existingWallets = await State.getWalletsFor(this.shared.sequence.stateProvider, loginSigner.signer)

      if (existingWallets.length > 0) {
        for (const wallet of existingWallets) {
          const preliminaryEntry: Wallet = {
            address: wallet.wallet,
            status: 'logging-in',
            loginEmail: loginSigner.loginEmail,
            loginType: loginSigner.extra.signerKind,
            loginDate: new Date().toISOString(),
            device: '' as `0x${string}`,
            useGuard: false,
          }
          await this.shared.databases.manager.set(preliminaryEntry)
        }

        const result = await this.walletSelectionUiHandler({
          existingWallets: existingWallets.map((w) => w.wallet),
          signerAddress: await loginSigner.signer.address,
          context: isAuthCodeArgs(args) ? { isRedirect: args.isRedirect, target: args.target } : { isRedirect: false },
        })

        if (result === 'abort-signup') {
          for (const wallet of existingWallets) {
            const finalEntry = await this.shared.databases.manager.get(wallet.wallet)
            if (finalEntry && !finalEntry.device) {
              await this.shared.databases.manager.del(wallet.wallet)
            }
          }

          args.onStatusChange?.({ type: 'signup-aborted' })

          // Abort the signup process
          return undefined
        }

        if (result === 'create-new') {
          for (const wallet of existingWallets) {
            await this.shared.databases.manager.del(wallet.wallet)
          }
          // Continue with the signup process
        } else {
          throw new Error('invalid-result-from-wallet-selector')
        }
      }
    } else {
      console.warn('No wallet selector registered, creating a new wallet')
    }

    // Create the first session
    const device = await this.shared.modules.devices.create()

    args.onStatusChange?.({ type: 'device-signer-created', address: device.address })

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
      : (buildCappedTreeFromTopology(1n, this.shared.sequence.defaultGuardTopology) as Config.NestedLeaf)

    // Add modules
    let modules: Module[] = []

    if (!args.noSessionManager) {
      //  Calculate image hash with the identity signer
      const sessionsTopology = SessionConfig.emptySessionsTopology(loginSignerAddress)
      // Store this tree in the state provider
      const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
      this.shared.sequence.stateProvider.saveTree(sessionsConfigTree)
      // Prepare the configuration leaf
      const sessionsImageHash = GenericTree.hash(sessionsConfigTree)
      const signer = {
        ...ManagerOptionsDefaults.defaultSessionsTopology,
        address: this.shared.sequence.extensions.sessions,
        imageHash: sessionsImageHash,
      }
      if (guardTopology) {
        modules.push({
          sapientLeaf: signer,
          weight: 255n,
          guardLeaf: guardTopology,
        })
      } else {
        modules.push({
          sapientLeaf: signer,
          weight: 255n,
        })
      }
    }

    if (!args.noRecovery) {
      await this.shared.modules.recovery.initRecoveryModule(modules, device.address)
    }

    // Create initial configuration
    const initialConfiguration = toConfig(0n, loginTopology, devicesTopology, modules, guardTopology)
    console.log('initialConfiguration', initialConfiguration)

    // Create wallet
    const context = args.use4337 ? this.shared.sequence.context4337 : this.shared.sequence.context
    const wallet = await CoreWallet.fromConfiguration(initialConfiguration, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
      context,
    })

    args.onStatusChange?.({ type: 'wallet-created', address: wallet.address })

    this.shared.modules.logger.log('Created new sequence wallet:', wallet.address)

    // Sign witness using device signer
    await this.shared.modules.devices.witness(device.address, wallet.address)

    // Sign witness using the passkey signer
    await loginSigner.signer.witness(this.shared.sequence.stateProvider, wallet.address, loginSigner.extra)

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

    // Store passkey credential ID mapping if this is a passkey signup
    if (args.kind === 'passkey' && loginSigner.signer instanceof Signers.Passkey.Passkey) {
      try {
        await this.shared.databases.passkeyCredentials.storeCredential(
          loginSigner.signer.credentialId,
          loginSigner.signer.publicKey,
          wallet.address,
        )
        this.shared.modules.logger.log('Stored passkey credential mapping for wallet:', wallet.address)
      } catch (error) {
        console.error('[Wallets/signUp] Error saving passkey mapping:', error)
        // Don't throw the error as this is not critical to the signup process
      }
    }

    args.onStatusChange?.({ type: 'signup-completed' })

    return wallet.address
  }

  public async getConfigurationParts(address: Address.Address) {
    const wallet = new CoreWallet(address, {
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
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    await wallet.submitUpdate(request.envelope as Envelope.Signed<Payload.ConfigUpdate>)
    await this.shared.modules.signatures.complete(requestId)
  }

  async login(args: LoginArgs): Promise<string> {
    if (isLoginToWalletArgs(args)) {
      try {
        const existingWallet = await this.get(args.wallet)

        if (existingWallet?.status === 'ready') {
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
          ...prevDevices.signers.filter((x) => x !== Constants.ZeroAddress).map((x) => ({ address: x })),
          ...prevDevices.sapientSigners.map((x) => ({ address: x.address, imageHash: x.imageHash })),
          { address: device.address },
        ])

        if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
          await this.shared.modules.recovery.addRecoverySignerToModules(modules, device.address)
        }

        const walletEntryToUpdate: Wallet = {
          ...(existingWallet as Wallet),
          address: args.wallet,
          status: 'logging-in' as const,
          loginDate: new Date().toISOString(),
          device: device.address,
          loginType: existingWallet?.loginType || this.pendingMnemonicOrPasskeyLogin || 'wallet',
          loginEmail: existingWallet?.loginEmail,
          useGuard: guardTopology !== undefined,
        }

        await this.shared.databases.manager.set(walletEntryToUpdate)

        const requestId = await this.requestConfigurationUpdate(
          args.wallet,
          {
            devicesTopology: nextDevicesTopology,
            modules,
          },
          'login',
          'wallet-webapp',
        )
        return requestId
      } catch (error) {
        throw error
      } finally {
        this.pendingMnemonicOrPasskeyLogin = undefined
      }
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

      // Ready the signer on the handler so it can be used to complete the login configuration update
      const mnemonicHandler = this.shared.handlers.get(Kinds.LoginMnemonic) as MnemonicHandler
      mnemonicHandler.addReadySigner(mnemonicSigner)
      this.pendingMnemonicOrPasskeyLogin = Kinds.LoginMnemonic

      return this.login({ wallet })
    }

    if (isLoginToPasskeyArgs(args)) {
      // Use optimized login that avoids the discovery WebAuthn call
      const optimizer = new PasskeyLoginOptimizer(this.shared)

      try {
        const { selectedWallet, passkeySigner } = await optimizer.loginWithStoredCredentials(args.selectWallet)

        // Store the passkey signer for later use during signing
        const passkeysHandler = this.shared.handlers.get(Kinds.LoginPasskey)
        if (passkeysHandler && 'addReadySigner' in passkeysHandler) {
          ;(passkeysHandler as any).addReadySigner(passkeySigner)
        }

        this.pendingMnemonicOrPasskeyLogin = Kinds.LoginPasskey

        this.shared.modules.logger.log('Optimized passkey login - skipped discovery interaction')
        return this.login({ wallet: selectedWallet })
      } catch (error) {
        // Fallback to original method if optimization fails
        this.shared.modules.logger.log('Optimized passkey login failed, falling back to discovery method:', error)

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

        // Store discovered credentials for future optimized logins
        await optimizer.storeDiscoveredCredentials(
          passkeySigner,
          wallets.map((w) => w.wallet),
        )

        const wallet = await args.selectWallet(wallets.map((w) => w.wallet))
        if (!wallets.some((w) => Address.isEqual(w.wallet, wallet))) {
          throw new Error('wallet-not-found')
        }
        this.pendingMnemonicOrPasskeyLogin = Kinds.LoginPasskey

        return this.login({ wallet })
      }
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

    const requestId = await this._prepareDeviceRemovalUpdate(wallet, device.address, 'logout')

    await this.shared.databases.manager.set({ ...walletEntry, status: 'logging-out' })

    return requestId as any
  }

  public async remoteLogout(wallet: Address.Address, deviceAddress: Address.Address): Promise<string> {
    const walletEntry = await this.get(wallet)
    if (!walletEntry) {
      throw new Error('wallet-not-found')
    }

    if (Address.isEqual(walletEntry.device, deviceAddress)) {
      throw new Error('cannot-remote-logout-from-local-device')
    }

    const requestId = await this._prepareDeviceRemovalUpdate(wallet, deviceAddress, 'remote-logout')

    return requestId
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
      guard:
        guardSigners && guardSigners.signers.length > 0
          ? (await this.shared.modules.signers.resolveKinds(wallet, guardSigners.signers))[0]
          : undefined,
      raw,
    }
  }

  async getNonce(chainId: number, address: Address.Address, space: bigint) {
    const wallet = new CoreWallet(address, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))
    return wallet.getNonce(provider, space)
  }

  async getOnchainConfiguration(wallet: Address.Address, chainId: number) {
    const walletObject = new CoreWallet(wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))
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

  async isUpdatedOnchain(wallet: Address.Address, chainId: number) {
    const walletObject = new CoreWallet(wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const network = this.shared.sequence.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error('network-not-found')
    }

    const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))
    const onchainStatus = await walletObject.getStatus(provider)
    return onchainStatus.imageHash === onchainStatus.onChainImageHash
  }

  private async _prepareDeviceRemovalUpdate(
    wallet: Address.Address,
    deviceToRemove: Address.Address,
    action: 'logout' | 'remote-logout',
  ): Promise<string> {
    const { devicesTopology, modules } = await this.getConfigurationParts(wallet)

    // The result of this entire inner block is a clean, simple list of the remaining devices, ready to be rebuilt.
    const nextDevicesTopology = buildCappedTree([
      ...Config.getSigners(devicesTopology)
        .signers.filter((x) => x !== Constants.ZeroAddress && !Address.isEqual(x, deviceToRemove))
        .map((x) => ({ address: x })),
      ...Config.getSigners(devicesTopology).sapientSigners,
    ])

    // Remove the device from the recovery module's topology as well.
    if (this.shared.modules.recovery.hasRecoveryModule(modules)) {
      await this.shared.modules.recovery.removeRecoverySignerFromModules(modules, deviceToRemove)
    }

    // Request the configuration update.
    const requestId = await this.requestConfigurationUpdate(
      wallet,
      {
        devicesTopology: nextDevicesTopology,
        modules,
      },
      action,
      'wallet-webapp',
    )

    return requestId
  }
}

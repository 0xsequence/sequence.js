import { Address, Hex, Mnemonic } from 'ox'
import { Envelope, Signers, Wallet } from '@0xsequence/sequence-core'
import { Config, Payload } from '@0xsequence/sequence-primitives'
import { Kinds, WitnessExtraSignerKind } from './signers'
import { Shared } from './manager'
import { MnemonicHandler } from './handlers/mnemonic'
import * as Db from '../dbs'

export type WalletRow = Db.WalletRow

export type CommonSignupArgs = {
  noGuard?: boolean
}

export type PasskeySignupArgs = CommonSignupArgs & {
  kind: 'passkey'
}

export type MnemonicSignupArgs = CommonSignupArgs & {
  kind: 'mnemonic'
  mnemonic: string
}

export type SignupArgs = PasskeySignupArgs | MnemonicSignupArgs

export type LoginToWalletArgs = {
  wallet: Address.Address
}

export type LoginArgs = LoginToWalletArgs

export function isLoginToWalletArgs(args: LoginArgs): args is LoginToWalletArgs {
  return 'wallet' in args
}

function buildCappedTree(members: Address.Address[]): Config.Topology {
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
    return {
      type: 'signer',
      address: members[0],
      weight: loginMemberWeight,
    } as Config.SignerLeaf
  }

  // Limit their total signing power
  return {
    type: 'nested',
    weight: loginMemberWeight,
    threshold: 1n,
    tree: Config.flatLeavesToTopology(
      members.map((member) => ({
        type: 'signer',
        address: member,
        weight: 1n,
      })),
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
  constructor(private readonly shared: Shared) {}

  public async exists(wallet: Address.Address): Promise<boolean> {
    return this.shared.databases.manager.get(wallet).then((r) => r !== undefined)
  }

  public async list(): Promise<WalletRow[]> {
    return this.shared.databases.manager.list()
  }

  public onWalletsUpdate(cb: (wallets: WalletRow[]) => void, trigger?: boolean) {
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
        const passkeySigner = await Signers.Passkey.Passkey.create(this.shared.sequence.extensions)
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
    }
  }

  async signUp(args: SignupArgs) {
    const loginSigner = await this.prepareSignUp(args)

    // Create the first session
    const device = await this.shared.modules.devices.create()

    if (!args.noGuard && !this.shared.sequence.defaultGuardTopology) {
      throw new Error('guard is required for signup')
    }

    // Build the login tree
    const loginTopology = buildCappedTree([await loginSigner.signer.address])
    const devicesTopology = buildCappedTree([device.address])
    const guardTopology = args.noGuard
      ? undefined
      : buildCappedTreeFromTopology(1n, this.shared.sequence.defaultGuardTopology)

    // TODO: Add recovery module
    // TODO: Add smart sessions module
    // Placeholder
    const modules = {
      type: 'signer',
      address: '0x0000000000000000000000000000000000000000',
      weight: 0n,
    } as Config.SignerLeaf

    // Create initial configuration
    const initialConfiguration = toConfig(0n, loginTopology, devicesTopology, modules, guardTopology)

    // Create wallet
    const wallet = await Wallet.fromConfiguration(initialConfiguration, {
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
      loginType: 'passkey',
      useGuard: !args.noGuard,
    })

    return wallet.address
  }

  async login(args: LoginArgs) {
    if (isLoginToWalletArgs(args)) {
      const prevWallet = await this.exists(args.wallet)
      if (prevWallet) {
        throw new Error('wallet-already-logged-in')
      }

      const wallet = new Wallet(args.wallet, {
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
        ...prevDevices.signers.filter((x) => x !== '0x0000000000000000000000000000000000000000'),
        device.address,
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
        loginType: 'passkey',
        useGuard: guardTopology !== undefined,
      })

      return requestId
    }
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

    const wallet = new Wallet(request.wallet, {
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

    const walletObj = new Wallet(wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const status = await walletObj.getStatus()
    const { loginTopology, devicesTopology, modules, guardTopology } = fromConfig(status.configuration)

    const nextDevicesTopology = buildCappedTree(
      Config.getSigners(devicesTopology).signers.filter(
        (x) => x !== device.address && x !== '0x0000000000000000000000000000000000000000',
      ),
    )

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

    const wallet = new Wallet(request.wallet, {
      context: this.shared.sequence.context,
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    await wallet.submitUpdate(request.envelope as Envelope.Signed<Payload.ConfigUpdate>, {
      validateSave: !options?.skipValidateSave,
    })

    await this.shared.modules.signatures.complete(requestId)
    await this.shared.databases.manager.del(request.wallet)
  }
}

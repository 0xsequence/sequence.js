import { ChainId, NetworkConfig, allNetworks, findNetworkConfig } from '@0xsequence/network'
import { jwtDecodeClaims } from '@0xsequence/utils'
import { Account } from '@0xsequence/account'
import { ethers } from 'ethers'
import { tracker, trackers } from '@0xsequence/sessions'
import { Orchestrator, SignatureOrchestrator, signers } from '@0xsequence/signhub'
import { migrator } from '@0xsequence/migration'
import { commons, universal, v1 } from '@0xsequence/core'
import { Services, ServicesSettings, SessionJWT, SessionMeta } from './services'

export interface SessionDumpV1 {
  config: Omit<v1.config.WalletConfig, 'version'> & { address?: string }
  jwt?: SessionJWT
  metadata: SessionMeta
}

export interface SessionDumpV2 {
  version: 2
  address: string
  jwt?: SessionJWT
  metadata?: SessionMeta
}

export function isSessionDumpV1(obj: any): obj is SessionDumpV1 {
  return obj.config && obj.metadata && obj.version === undefined
}

export function isSessionDumpV2(obj: any): obj is SessionDumpV2 {
  return obj.version === 2 && obj.address
}

// These chains are always validated for migrations
// if they are not available, the login will fail
export const CRITICAL_CHAINS = [1, 137]

export type SessionSettings = {
  services?: ServicesSettings
  contexts: commons.context.VersionedContext
  networks: NetworkConfig[]
  tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
}

export const SessionSettingsDefault: SessionSettings = {
  contexts: commons.context.defaultContexts,
  networks: allNetworks,
  tracker: new trackers.remote.RemoteConfigTracker('https://sessions.sequence.app')
}

export class Session {
  constructor(
    public networks: NetworkConfig[],
    public contexts: commons.context.VersionedContext,
    public account: Account,
    public services?: Services
  ) {}

  async dump(): Promise<SessionDumpV2> {
    const base = {
      version: 2 as const,
      address: this.account.address
    }

    if (this.services) {
      return {
        ...base,
        ...(await this.services.dump())
      }
    }

    return base
  }

  static async singleSigner(args: {
    settings?: Partial<SessionSettings>
    signer: ethers.Signer | signers.SapientSigner | string
    selectWallet?: (wallets: string[]) => Promise<string | undefined>
    onAccountAddress?: (address: string) => void
    onMigration?: (account: Account) => Promise<boolean>
    editConfigOnMigration?: (config: commons.config.Config) => commons.config.Config
    projectAccessKey: string
  }): Promise<Session> {
    let { signer } = args

    if (typeof signer === 'string') {
      signer = new ethers.Wallet(signer)
    }

    const orchestrator = new Orchestrator([signer])
    const referenceSigner = await signer.getAddress()
    const threshold = 1
    const addSigners = [
      {
        weight: 1,
        address: referenceSigner
      }
    ]

    const selectWallet =
      args.selectWallet ||
      (async (wallets: string[]) => {
        if (wallets.length === 0) return undefined

        // Find a wallet that was originally created
        // as a 1/1 of the reference signer
        const tracker = args.settings?.tracker ?? SessionSettingsDefault.tracker

        const configs = await Promise.all(
          wallets.map(async wallet => {
            const imageHash = await tracker.imageHashOfCounterfactualWallet({ wallet })

            return {
              wallet,
              config: imageHash && (await tracker.configOfImageHash({ imageHash: imageHash.imageHash }))
            }
          })
        )

        for (const config of configs) {
          if (!config.config) {
            continue
          }

          const coder = universal.genericCoderFor(config.config.version)
          const signers = coder.config.signersOf(config.config)

          if (signers.length === 1 && signers[0].address === referenceSigner) {
            return config.wallet
          }
        }

        return undefined
      })

    return Session.open({
      ...args,
      orchestrator,
      referenceSigner,
      threshold,
      addSigners,
      selectWallet
    })
  }

  static async open(args: {
    settings?: Partial<SessionSettings>
    orchestrator: SignatureOrchestrator
    addSigners?: commons.config.SimpleSigner[]
    referenceSigner: string
    threshold?: ethers.BigNumberish
    selectWallet: (wallets: string[]) => Promise<string | undefined>
    onAccountAddress?: (address: string) => void
    editConfigOnMigration?: (config: commons.config.Config) => commons.config.Config
    onMigration?: (account: Account) => Promise<boolean>
    projectAccessKey?: string
  }): Promise<Session> {
    const {
      referenceSigner,
      threshold,
      addSigners,
      selectWallet,
      onAccountAddress,
      settings,
      editConfigOnMigration,
      onMigration,
      orchestrator,
      projectAccessKey
    } = args

    const { contexts, networks, tracker, services } = { ...SessionSettingsDefault, ...settings }

    // The reference network is mainnet, if mainnet is not available, we use the first network
    const referenceChainId =
      findNetworkConfig(networks, settings?.services?.sequenceApiChainId ?? ChainId.MAINNET)?.chainId ?? networks[0]?.chainId
    if (!referenceChainId) throw Error('No reference chain found')

    const foundWallets = await tracker.walletsOfSigner({ signer: referenceSigner })
    const selectedWallet = await selectWallet(foundWallets.map(w => w.wallet))

    let account: Account

    if (selectedWallet) {
      onAccountAddress?.(selectedWallet)

      // existing account, lets update it
      account = new Account({
        address: selectedWallet,
        tracker,
        networks,
        contexts,
        orchestrator,
        projectAccessKey
      })

      // Get the latest configuration of the wallet (on the reference chain)
      // now this configuration should be of the latest version, so we can start
      // manipulating it.

      // NOTICE: We are performing the wallet update on a single chain, assuming that
      // all other networks have the same configuration. This is not always true.
      if (addSigners && addSigners.length > 0) {
        // New wallets never need migrations
        // (because we create them on the latest version)
        let status = await account.status(referenceChainId)

        // If the wallet was created originally on v2, then we can skip
        // the migration checks all together.
        if (status.original.version !== status.version || account.version !== status.version) {
          // Account may not have been migrated yet, so we need to check
          // if it has been migrated and if not, migrate it (in all chains)
          const { migratedAllChains: isFullyMigrated, failedChains } = await account.isMigratedAllChains()

          // Failed chains must not contain mainnet or polygon, otherwise we cannot proceed.
          if (failedChains.some(c => CRITICAL_CHAINS.includes(c))) {
            throw Error(`Failed to fetch account status on ${failedChains.join(', ')}`)
          }

          if (!isFullyMigrated) {
            // This is an oportunity for whoever is opening the session to
            // feed the orchestrator with more signers, so that the migration
            // can be completed.
            if (onMigration && !(await onMigration(account))) {
              throw Error('Migration cancelled, cannot open session')
            }

            const { failedChains } = await account.signAllMigrations(editConfigOnMigration || (c => c))
            if (failedChains.some(c => CRITICAL_CHAINS.includes(c))) {
              throw Error(`Failed to sign migrations on ${failedChains.join(', ')}`)
            }

            // If we are using a dedupped tracker we need to invalidate the cache
            // otherwise we run the risk of not seeing the signed migrations reflected.
            if (trackers.isDedupedTracker(tracker)) {
              tracker.invalidateCache()
            }

            let isFullyMigrated2: boolean
            ;[isFullyMigrated2, status] = await Promise.all([
              account.isMigratedAllChains().then(r => r.migratedAllChains),
              account.status(referenceChainId)
            ])

            if (!isFullyMigrated2) throw Error('Failed to migrate account')
          }
        }

        // NOTICE: We only need to do this because the API will not be able to
        // validate the v2 signature (if the account has an onchain version of 1)
        // we could speed this up by sending the migration alongside the jwt request
        // and letting the API validate it offchain.
        if (status.onChain.version !== status.version) {
          await account.doBootstrap(referenceChainId, undefined, status)
        }

        const prevConfig = status.config
        const nextConfig = account.coders.config.editConfig(prevConfig, {
          add: addSigners,
          threshold
        })

        // Only update the onchain config if the imageHash has changed
        if (account.coders.config.imageHashOf(prevConfig) !== account.coders.config.imageHashOf(nextConfig)) {
          const newConfig = account.coders.config.editConfig(nextConfig, {
            checkpoint: account.coders.config.checkpointOf(prevConfig) + 1n
          })

          await account.updateConfig(newConfig)
        }
      }
    } else {
      if (!addSigners || addSigners.length === 0) {
        throw Error('Cannot create new account without signers')
      }

      if (!threshold) {
        throw Error('Cannot create new account without threshold')
      }

      // fresh account
      account = await Account.new({
        config: { threshold, checkpoint: 0, signers: addSigners },
        tracker,
        contexts,
        orchestrator,
        networks,
        projectAccessKey
      })

      onAccountAddress?.(account.address)

      // sign a digest and send it to the tracker
      // otherwise the tracker will not know about this account
      await account.publishWitness()

      // safety check, the remove tracker should be able to find
      // this account for the reference signer
      const foundWallets = await tracker.walletsOfSigner({ signer: referenceSigner, noCache: true })
      if (!foundWallets.some(w => w.wallet === account.address)) {
        throw Error('Account not found on tracker')
      }
    }

    let servicesObj: Services | undefined

    if (services) {
      servicesObj = new Services(account, services)
      servicesObj.auth() // fire and forget

      servicesObj.onAuth(result => {
        if (result.status === 'fulfilled') {
          account.setJwt(result.value)
        }
      })
    }

    return new Session(networks, contexts, account, servicesObj)
  }

  static async load(args: {
    settings?: Partial<SessionSettings>
    orchestrator: SignatureOrchestrator
    dump: SessionDumpV1 | SessionDumpV2
    editConfigOnMigration: (config: commons.config.Config) => commons.config.Config
    onMigration?: (account: Account) => Promise<boolean>
    projectAccessKey?: string
  }): Promise<Session> {
    const { dump, settings, editConfigOnMigration, onMigration, orchestrator, projectAccessKey } = args
    const { contexts, networks, tracker, services } = { ...SessionSettingsDefault, ...settings }

    let account: Account

    if (isSessionDumpV1(dump)) {
      // Old configuration format used to also contain an "address" field
      // but if it doesn't, it means that it was a "counterfactual" account
      // not yet updated, so we need to compute the address
      const oldAddress =
        dump.config.address ||
        commons.context.addressOf(contexts[1], v1.config.ConfigCoder.imageHashOf({ ...dump.config, version: 1 }))

      const jwtExpired = (dump.jwt?.expiration ?? 0) < Math.floor(Date.now() / 1000)

      account = new Account({
        address: oldAddress,
        tracker,
        networks,
        contexts,
        orchestrator,
        jwt: jwtExpired ? undefined : dump.jwt?.token,
        projectAccessKey
      })

      // TODO: This property may not hold if the user adds a new network
      if (!(await account.isMigratedAllChains().then(r => r.migratedAllChains))) {
        // This is an oportunity for whoever is opening the session to
        // feed the orchestrator with more signers, so that the migration
        // can be completed.
        if (onMigration && !(await onMigration(account))) {
          throw Error('Migration cancelled, cannot open session')
        }

        console.log('Migrating account...')
        await account.signAllMigrations(editConfigOnMigration)
        if (!(await account.isMigratedAllChains().then(r => r.migratedAllChains))) throw Error('Failed to migrate account')
      }

      // We may need to update the JWT if the account has been migrated
    } else if (isSessionDumpV2(dump)) {
      const jwtExpired = (dump.jwt?.expiration ?? 0) < Math.floor(Date.now() / 1000)

      account = new Account({
        address: dump.address,
        tracker,
        networks,
        contexts,
        orchestrator,
        jwt: jwtExpired ? undefined : dump.jwt?.token,
        projectAccessKey
      })
    } else {
      throw Error('Invalid dump format')
    }

    let servicesObj: Services | undefined

    if (services) {
      servicesObj = new Services(
        account,
        services,
        dump.jwt && {
          jwt: {
            token: Promise.resolve(dump.jwt.token),
            expiration: dump.jwt.expiration ?? jwtDecodeClaims(dump.jwt.token).exp
          },
          metadata: dump.metadata
        }
      )
    }

    return new Session(networks, contexts, account, servicesObj)
  }
}

import { config as dotenvConfig } from 'dotenv'
import { Abi, Address, Provider, RpcTransport } from 'ox'
import { Manager, ManagerOptions, ManagerOptionsDefaults } from '../src/sequence'
import { mockEthereum } from './setup'
import { Signers as CoreSigners, State, Relayer } from '@0xsequence/wallet-core'
import * as Db from '../src/dbs'
import { Network } from '@0xsequence/wallet-primitives'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0xb7bE532959236170064cf099e1a3395aEf228F44'
export const EMITTER_ABI = Abi.from(['function explicitEmit()', 'function implicitEmit()'])

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY
export const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545'

let testIdCounter = 0

export function newManager(options?: ManagerOptions, noEthereumMock?: boolean, tag?: string) {
  if (!noEthereumMock) {
    mockEthereum()
  }

  testIdCounter++
  const dbSuffix = tag ? `_${tag}_testrun_${testIdCounter}` : `_testrun_${testIdCounter}`

  // Ensure options and its identity sub-object exist for easier merging
  const effectiveOptions = {
    ...options,
    identity: { ...ManagerOptionsDefaults.identity, ...options?.identity },
  }

  return new Manager({
    stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore()),
    networks: [
      {
        name: 'Arbitrum (local fork)',
        type: Network.NetworkType.MAINNET,
        rpcUrl: LOCAL_RPC_URL,
        chainId: 42161n,
        blockExplorer: { url: 'https://arbiscan.io/' },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      },
    ],
    // Override DBs with unique names if not provided in options,
    // otherwise, use the provided DB instance.
    // This assumes options?.someDb is either undefined or a fully constructed DB instance.
    encryptedPksDb: effectiveOptions.encryptedPksDb || new CoreSigners.Pk.Encrypted.EncryptedPksDb('pk-db' + dbSuffix),
    managerDb: effectiveOptions.managerDb || new Db.Wallets('sequence-manager' + dbSuffix),
    messagesDb: effectiveOptions.messagesDb || new Db.Messages('sequence-messages' + dbSuffix),
    transactionsDb: effectiveOptions.transactionsDb || new Db.Transactions('sequence-transactions' + dbSuffix),
    signaturesDb: effectiveOptions.signaturesDb || new Db.Signatures('sequence-signature-requests' + dbSuffix),
    authCommitmentsDb:
      effectiveOptions.authCommitmentsDb || new Db.AuthCommitments('sequence-auth-commitments' + dbSuffix),
    authKeysDb: effectiveOptions.authKeysDb || new Db.AuthKeys('sequence-auth-keys' + dbSuffix),
    recoveryDb: effectiveOptions.recoveryDb || new Db.Recovery('sequence-recovery' + dbSuffix),
    ...effectiveOptions,
  })
}

export function newRemoteManager(
  remoteManagerOptions: {
    network: {
      relayerPk: string
      bundlerUrl: string
      rpcUrl: string
      chainId: number
    }
    tag?: string
  },
  options?: ManagerOptions,
) {
  testIdCounter++
  const dbSuffix = remoteManagerOptions?.tag
    ? `_${remoteManagerOptions.tag}_testrun_${testIdCounter}`
    : `_testrun_${testIdCounter}`

  let relayers: Relayer.Relayer[] = []
  let bundlers: Relayer.Bundler[] = []

  if (remoteManagerOptions.network.relayerPk) {
    const provider = Provider.from(RpcTransport.fromHttp(remoteManagerOptions.network.rpcUrl))
    relayers.push(new Relayer.Standard.PkRelayer(remoteManagerOptions.network.relayerPk as `0x${string}`, provider))
  }

  if (remoteManagerOptions.network.bundlerUrl) {
    bundlers.push(
      new Relayer.Bundlers.PimlicoBundler(
        remoteManagerOptions.network.bundlerUrl,
        Provider.from(RpcTransport.fromHttp(remoteManagerOptions.network.rpcUrl)),
      ),
    )
  }

  // Ensure options and its identity sub-object exist for easier merging
  const effectiveOptions = {
    relayers,
    bundlers,
    ...options,
    identity: { ...ManagerOptionsDefaults.identity, ...options?.identity },
  }

  return new Manager({
    networks: [
      {
        name: 'Remote Test Network',
        type: Network.NetworkType.MAINNET,
        rpcUrl: remoteManagerOptions.network.rpcUrl,
        chainId: remoteManagerOptions.network.chainId,
        blockExplorer: { url: 'https://undefined/' },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      },
    ],
    // Override DBs with unique names if not provided in options,
    // otherwise, use the provided DB instance.
    // This assumes options?.someDb is either undefined or a fully constructed DB instance.
    encryptedPksDb: effectiveOptions.encryptedPksDb || new CoreSigners.Pk.Encrypted.EncryptedPksDb('pk-db' + dbSuffix),
    managerDb: effectiveOptions.managerDb || new Db.Wallets('sequence-manager' + dbSuffix),
    messagesDb: effectiveOptions.messagesDb || new Db.Messages('sequence-messages' + dbSuffix),
    transactionsDb: effectiveOptions.transactionsDb || new Db.Transactions('sequence-transactions' + dbSuffix),
    signaturesDb: effectiveOptions.signaturesDb || new Db.Signatures('sequence-signature-requests' + dbSuffix),
    authCommitmentsDb:
      effectiveOptions.authCommitmentsDb || new Db.AuthCommitments('sequence-auth-commitments' + dbSuffix),
    authKeysDb: effectiveOptions.authKeysDb || new Db.AuthKeys('sequence-auth-keys' + dbSuffix),
    recoveryDb: effectiveOptions.recoveryDb || new Db.Recovery('sequence-recovery' + dbSuffix),
    ...effectiveOptions,
  })
}

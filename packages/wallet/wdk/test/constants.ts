import { config as dotenvConfig } from 'dotenv'
import { Abi, Address } from 'ox'
import { Manager, ManagerOptions, ManagerOptionsDefaults } from '../src/sequence'
import { mockEthereum } from './setup'
import { Signers as CoreSigners } from '@0xsequence/wallet-core'
import * as Db from '../src/dbs'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0x363147Ff23385FAEbC689C450477fD4e07F427A6'
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
    networks: [
      {
        name: 'Arbitrum (local fork)',
        rpc: LOCAL_RPC_URL,
        chainId: 42161n,
        explorer: 'https://arbiscan.io/',
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
    transactionsDb: effectiveOptions.transactionsDb || new Db.Transactions('sequence-transactions' + dbSuffix),
    signaturesDb: effectiveOptions.signaturesDb || new Db.Signatures('sequence-signature-requests' + dbSuffix),
    authCommitmentsDb:
      effectiveOptions.authCommitmentsDb || new Db.AuthCommitments('sequence-auth-commitments' + dbSuffix),
    authKeysDb: effectiveOptions.authKeysDb || new Db.AuthKeys('sequence-auth-keys' + dbSuffix),
    recoveryDb: effectiveOptions.recoveryDb || new Db.Recovery('sequence-recovery' + dbSuffix),
    ...effectiveOptions,
  })
}

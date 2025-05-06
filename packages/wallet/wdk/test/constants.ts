import { config as dotenvConfig } from 'dotenv'
import { Abi, Address } from 'ox'
import { Manager, ManagerOptions } from '../src/sequence'
import { mockEthereum } from './setup'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0x7F6e420Ed3017A36bE6e1DA8e3AFE61569eb4840'
export const EMITTER_ABI = Abi.from(['function explicitEmit()', 'function implicitEmit()'])

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY
export const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545'
console.log('LOCAL_RPC_URL', LOCAL_RPC_URL)

export function newManager(options?: ManagerOptions, noEthereumMock?: boolean) {
  if (!noEthereumMock) {
    mockEthereum()
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
    ...options,
  })
}

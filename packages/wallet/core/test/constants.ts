import { config as dotenvConfig } from 'dotenv'
import { Abi, AbiEvent, Address } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

// Requires https://example.com redirectUrl
export const EMITTER_ADDRESS1: Address.Address = '0xad90eB52BC180Bd9f66f50981E196f3E996278D3'
// Requires https://another-example.com redirectUrl
export const EMITTER_ADDRESS2: Address.Address = '0x4cb8d282365C7bee8C0d3Bf1B3ca5828e0Db553F'
export const EMITTER_FUNCTIONS = Abi.from(['function explicitEmit()', 'function implicitEmit()'])
export const EMITTER_EVENT_TOPICS = [
  AbiEvent.encode(AbiEvent.from('event Explicit(address sender)')).topics[0],
  AbiEvent.encode(AbiEvent.from('event Implicit(address sender)')).topics[0],
]
export const USDC_ADDRESS: Address.Address = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'

// Environment variables
export const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545'

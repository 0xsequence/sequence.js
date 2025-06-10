import { config as dotenvConfig } from 'dotenv'
import { Abi, AbiEvent, Address } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0x363147Ff23385FAEbC689C450477fD4e07F427A6'
export const EMITTER_FUNCTIONS = Abi.from(['function explicitEmit()', 'function implicitEmit()'])
export const EMITTER_EVENT_TOPICS = [
  AbiEvent.encode(AbiEvent.from('event Explicit(address sender)')).topics[0],
  AbiEvent.encode(AbiEvent.from('event Implicit(address sender)')).topics[0],
]

// Environment variables
export const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545'
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

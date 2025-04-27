import { config as dotenvConfig } from 'dotenv'
import { Abi, Address } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0x7F6e420Ed3017A36bE6e1DA8e3AFE61569eb4840'
export const EMITTER_ABI = Abi.from(['function explicitEmit()', 'function implicitEmit()'])

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

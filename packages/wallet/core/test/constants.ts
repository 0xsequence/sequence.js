import { config as dotenvConfig } from 'dotenv'
import { Abi, Address } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const EMITTER_ADDRESS: Address.Address = '0xb9239d78e60F3491b36538C6e51916c7B552cCBb'
export const EMITTER_ABI = Abi.from(['function explicitEmit()', 'function implicitEmit()'])

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

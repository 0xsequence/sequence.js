import { config as dotenvConfig } from 'dotenv'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const MOCK_IMPLICIT_CONTRACT = '0x9D5E1139e02eB025470308EeF65D2d15bC1f5d9F'
export const MOCK_IMPLICIT_INVALID_CONTRACT = '0x977F7fbCAc606C3B33357ebDff0205B8C4055a3B'

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

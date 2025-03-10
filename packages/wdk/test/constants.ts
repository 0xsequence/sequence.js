import { config as dotenvConfig } from 'dotenv'
import { Abi } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const ERC20_IMPLICIT_MINT_CONTRACT = '0x7aC9f16587B279998f1522f8F737a28aCb4C9f06'
export const MOCK_IMPLICIT_CONTRACT = '0x9D5E1139e02eB025470308EeF65D2d15bC1f5d9F'
export const MOCK_IMPLICIT_INVALID_CONTRACT = '0x977F7fbCAc606C3B33357ebDff0205B8C4055a3B'

export const ERC20_MINT_ONCE = Abi.from(['function mintOnce(address to, uint256 amount)'])[0]

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

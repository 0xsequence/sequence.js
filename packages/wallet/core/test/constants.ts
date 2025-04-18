import { config as dotenvConfig } from 'dotenv'
import { Abi, Address } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const MOCK_IMPLICIT_CONTRACT: Address.Address = '0x041E0CDC028050519C8e6485B2d9840caf63773F'
export const MOCK_IMPLICIT_INVALID_CONTRACT: Address.Address = '0x99aA13abCDB1759Eb8653fB12090BA95bd793083'
export const ERC20_IMPLICIT_MINT_CONTRACT: Address.Address = '0xe19D4dBC90e371c4adC42f07344C2C9a50838d84'

export const ERC20_MINT_ONCE = Abi.from(['function mintOnce(address to, uint256 amount)'])[0]

export const EMITTER_ADDRESS: Address.Address = '0xb9239d78e60F3491b36538C6e51916c7B552cCBb'
export const EMITTER_ABI = Abi.from(['function explicitEmit()', 'function implicitEmit()'])

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

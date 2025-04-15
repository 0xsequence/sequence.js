import { config as dotenvConfig } from 'dotenv'
import { Abi } from 'ox'

const envFile = process.env.CI ? '.env.test' : '.env.test.local'
dotenvConfig({ path: envFile })

export const ERC20_IMPLICIT_MINT_CONTRACT = '0x96ea29a63fdCf897eDc059a7f7A7bf04Bf574eF3'
export const MOCK_IMPLICIT_CONTRACT = '0x95b45E3131e836Ed3773C169c2A7E0C52478F1C6'
export const MOCK_IMPLICIT_INVALID_CONTRACT = '0x4cFD26fBADCeef5dA7e1D1BF4894a36FdaDfA3d6'

export const ERC20_MINT_ONCE = Abi.from(['function mintOnce(address to, uint256 amount)'])[0]

// Environment variables
export const { RPC_URL, PRIVATE_KEY } = process.env
export const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

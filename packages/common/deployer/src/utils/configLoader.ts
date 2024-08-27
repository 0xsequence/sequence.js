import * as dotenv from 'dotenv'
import * as path from 'path'
import { HttpNetworkConfig, HttpNetworkHDAccountsConfig } from 'hardhat/types/config'
import { ethers } from 'ethers'

type EthereumNetworksTypes = 'rinkeby' | 'ropsten' | 'kovan' | 'goerli' | 'mainnet' | 'mumbai' | 'matic'

export const getEnvConfig = (env: string) => {
  const envFile = path.resolve(__dirname, `../../config/${env}.env`)
  const envLoad = dotenv.config({ path: envFile })

  if (envLoad.error) {
    console.warn('No config found, using default')
    return { ETH_MNEMONIC: ethers.Wallet.createRandom().mnemonic!.phrase }
  }

  return envLoad.parsed || {}
}

export const networkConfig = (network: EthereumNetworksTypes): HttpNetworkConfig => {
  const config = getEnvConfig('PROD')
  const networkConfig: HttpNetworkConfig = {
    url: (function (network) {
      switch (network) {
        case 'mumbai':
          return 'https://rpc-mumbai.matic.today/'

        case 'matic':
          return 'https://rpc-mainnet.matic.network'

        default:
          return `https://${network}.infura.io/v3/${config['INFURA_API_KEY']}`
      }
    })(network),
    accounts: {
      mnemonic: config['ETH_MNEMONIC'],
      initialIndex: 0,
      count: 10,
      path: `m/44'/60'/0'/0`
    } as HttpNetworkHDAccountsConfig,
    gas: 'auto',
    gasPrice: 'auto',
    gasMultiplier: 1,
    timeout: 20000,
    httpHeaders: {}
  }

  return networkConfig
}

// import '@nomiclabs/hardhat-truffle5'
import { networkConfig } from './src/utils/configLoader'

const ganacheNetwork = {
  url: 'http://127.0.0.1:8545',
  blockGasLimit: 6000000000
}

module.exports = {
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
        details: {
          yul: true
        }
      }
    }
  },
  paths: {
    tests: './src/tests'
  },
  networks: {
    goerli: networkConfig('goerli'),
    mumbai: networkConfig('mumbai'),
    matic: networkConfig('matic'),
    ganache: ganacheNetwork
  }
}

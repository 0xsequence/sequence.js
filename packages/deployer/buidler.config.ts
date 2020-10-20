import { usePlugin } from "@nomiclabs/buidler/config";
import { networkConfig } from './src/utils/configLoader'

usePlugin("@nomiclabs/buidler-truffle5");

const ganacheNetwork = {
  url: 'http://127.0.0.1:8545',
  blockGasLimit: 6000000000
}

module.exports = {
  solc: {
    version: "0.6.10",
    optimizer: {
      enabled: true,
      runs: 1000000
    },
  },
  paths:{
    tests: "src/tests"
  },
  networks: {
    rinkeby: networkConfig('rinkeby'),
    kovan: networkConfig('kovan'),
    goerli: networkConfig('goerli'),
    matic: networkConfig('matic'),
    mumbai: networkConfig('mumbai'),
    ganache: ganacheNetwork
  }
};

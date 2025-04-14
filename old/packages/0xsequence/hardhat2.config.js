/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.7.6',

  networks: {
    hardhat: {
      // gas: 10000000000000,
      // blockGasLimit: 10000000000000,
      // gasPrice: 2,
      initialBaseFeePerGas: 1,
      chainId: 31338,
      accounts: {
        mnemonic: 'ripple axis someone ridge uniform wrist prosper there frog rate olympic knee'
      },
      // loggingEnabled: true
      // verbose: true
    },
  }
}

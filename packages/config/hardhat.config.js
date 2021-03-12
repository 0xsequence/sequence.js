/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.7.6',

  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: 'ripple axis someone ridge uniform wrist prosper there frog rate olympic knee'
      }
    }
  }
}

import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

const config: HardhatUserConfig = {
  solidity: '0.7.6',

  networks: {
    hardhat: {
      initialBaseFeePerGas: 1,
      chainId: 31337,
      accounts: {
        mnemonic: 'ripple axis someone ridge uniform wrist prosper there frog rate olympic knee'
      }
    }
  }
}

export default config

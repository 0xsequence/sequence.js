import { ethers } from 'ethers'

// testAccounts with 10000 ETH each
export const testAccounts = [
  {
    address: '0x4e37e14f5d5aac4df1151c6e8df78b7541680853',
    privateKey: '0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3'
  },
  {
    address: '0x8a6e090a13d2dc04f87a127699952ce2d4428cd9',
    privateKey: '0x15d476cba8e6a981e77a00fa22a06ce7f418b80dbb3cb2860f67ea811da9b108'
  },
  {
    address: '0xf1fc4872058b066578008519970b7e789eea5040',
    privateKey: '0x5b7ce9d034f2d2d8cc5667fcd5986db6e4c1e73b51bc84d61fa0b197068e381a'
  },
  {
    address: '0x4875692d103162f4e29ccdd5678806043d3f16c7',
    privateKey: '0x02173b01073b895fa3f92335658b4b1bbb3686c06193069b5c5914157f6a360a'
  },
  {
    address: '0xf4b294d1fce145a73ce91b860b871e77573957e5',
    privateKey: '0xbbbf16b45613564ad7bff353d4cb9e249f5a6d6ac2ef27a256ffafb9afaf8d58'
  },
  {
    address: '0x3631d4d374c3710c3456d6b1de1ee8745fbff8ba',
    privateKey: '0x2c527b40d4db8eff67de1b6b583b5e15037d0e02f88143668e5626039199da48'
  }
]

export const getEOAWallet = (privateKey: string, provider?: string | ethers.Provider): ethers.Wallet => {
  // defaults
  if (!provider) {
    provider = 'http://localhost:8545'
  }

  const wallet = new ethers.Wallet(privateKey)

  if (typeof provider === 'string') {
    return wallet.connect(new ethers.JsonRpcProvider(provider, undefined, { cacheTimeout: -1 }))
  } else {
    return wallet.connect(provider)
  }
}

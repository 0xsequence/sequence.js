import { ethers } from "ethers"

export type WalletContext = {
  version: number,
  factory: string,
  mainModule: string,
  mainModuleUpgradable: string,
  guestModule: string,

  walletCreationCode: string,
}

export function addressOf(context: WalletContext, imageHash: ethers.BytesLike) {
  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [context.walletCreationCode, ethers.utils.hexZeroPad(context.mainModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', context.factory, imageHash, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

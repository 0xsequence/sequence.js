import { ArcadeumWalletConfig } from "./types"
import { ethers } from "ethers"
import * as WalletContract from "./commons/wallet_contract"

export function compareAddr(a: string, b: string): number {
  const bigA = ethers.utils.bigNumberify(a)
  const bigB = ethers.utils.bigNumberify(b)

  if (bigA.lt(bigB)) {
    return -1
  } else if (bigA.eq(bigB)) {
    return 0
  } else {
    return 1
  }
}

export function sortConfig(config: ArcadeumWalletConfig): ArcadeumWalletConfig {
  config.signers.sort((a, b) => compareAddr(a.address, b.address))
  return config
}

export function imageHash(config: ArcadeumWalletConfig): string {
  let imageHash = ethers.utils.solidityPack(['uint256'], [config.threshold])

  config.signers.forEach((a) => 
    imageHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint8', 'address'],
        [imageHash, a.weight, a.address]
      )
    )
  )

  return imageHash
}

export function addressOf(config: ArcadeumWalletConfig): string {
  const salt = imageHash(config)

  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [WalletContract.code, ethers.utils.hexZeroPad(config.context.mainModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', config.context.factory, salt, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

export async function ethSign(wallet: ethers.Wallet, message: string | Uint8Array) {
  let hash = ethers.utils.keccak256(message)
  let hashArray = ethers.utils.arrayify(hash)
  let ethsigNoType = await wallet.signMessage(hashArray)
  return ethsigNoType + '02'
}

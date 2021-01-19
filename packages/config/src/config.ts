
import { ethers, Signer as AbstractSigner } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { WalletContractBytecode } from './bytecode'

// WalletConfig is the configuration of key signers that can access
// and control the wallet
export interface WalletConfig {  
  threshold: number
  signers: {
    weight: number
    address: string
  }[]

  address?: string
  chainId?: number
}

export interface WalletState {
  context: WalletContext
  config: WalletConfig

  address: string
  chainId: number

  deployed: boolean
  imageHash: string
  currentImageHash?: string

  published?: boolean
}

export const createWalletConfig = async (threshold: number, signers: { weight: number, signer: string | AbstractSigner }[]): Promise<WalletConfig> => {
  const config: WalletConfig = {
    threshold,
    signers: []
  }
  signers.forEach(async s => {
    config.signers.push({
      weight: s.weight,
      address: AbstractSigner.isSigner(s.signer) ? await s.signer.getAddress() : s.signer,
    })
  })
  if (!isUsableConfig(config)) {
    throw new Error('wallet config is not usable')
  }
  return config
}

// isUsableConfig checks if a the sum of the owners in the configuration meets the necessary threshold to sign a transaction
// a wallet that has a non-usable configuration is not able to perform any transactions, and can be considered as destroyed
export const isUsableConfig = (config: WalletConfig): boolean => {
  const sum = config.signers.reduce((p, c) => ethers.BigNumber.from(c.weight).add(p), ethers.constants.Zero)
  return sum.gte(ethers.BigNumber.from(config.threshold))
}


export const isValidConfigSigners = (config: WalletConfig, signers: string[]): boolean => {
  if (signers.length === 0) return true
  const a = config.signers.map(s => s.address.toLowerCase())
  const b = signers.map(s => s.toLowerCase())
  let valid = true
  b.forEach(s => {
    if (!a.includes(s)) valid = false
  })
  return valid
}

export const addressOf = (config: WalletConfig, context: WalletContext): string => {
  if (config.address) return config.address

  const salt = imageHash(config)

  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(['bytes', 'bytes32'], [WalletContractBytecode, ethers.utils.hexZeroPad(context.mainModule, 32)])
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', context.factory, salt, codeHash])
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

export const imageHash = (config: WalletConfig): string => {
  let imageHash = ethers.utils.solidityPack(['uint256'], [config.threshold])

  config.signers.forEach(
    a =>
      (imageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint8', 'address'], [imageHash, a.weight, a.address])
      ))
  )

  return imageHash
}

// sortConfig normalizes the list of signer addreses in a WalletConfig
export const sortConfig = (config: WalletConfig): WalletConfig => {
  config.signers.sort((a, b) => compareAddr(a.address, b.address))
  return config
}

export const isConfigEqual = (a: WalletConfig, b: WalletConfig): boolean => {
  return imageHash(a) === imageHash(b)
}

export const compareAddr = (a: string, b: string): number => {
  const bigA = ethers.BigNumber.from(a)
  const bigB = ethers.BigNumber.from(b)

  if (bigA.lt(bigB)) {
    return -1
  } else if (bigA.eq(bigB)) {
    return 0
  } else {
    return 1
  }
}

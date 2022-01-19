import { ethers, Signer as AbstractSigner } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { WalletContractBytecode } from './bytecode'
import { cacheConfig } from './cache'

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
  config?: WalletConfig

  // the wallet address
  address: string
  
  // the chainId of the network
  chainId: number

  // whether the wallet has been ever deployed
  deployed: boolean
  
  // the imageHash of the `config` WalletConfig
  imageHash: string

  // the last imageHash of a WalletConfig, stored on-chain
  lastImageHash?: string
  
  // whether the WalletConfig object itself has been published to logs
  published?: boolean
}

// TODO: createWalletConfig and genConfig are very similar, lets update + remove one
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
  const a = config.signers.map(s => ethers.utils.getAddress(s.address))
  const b = signers.map(s => ethers.utils.getAddress(s))
  let valid = true
  b.forEach(s => {
    if (!a.includes(s)) valid = false
  })
  return valid
}

export const addressOf = (salt: WalletConfig | string, context: WalletContext, ignoreAddress: boolean = false): string => {
  if (typeof salt === 'string') {
    const codeHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes', 'bytes32'], [WalletContractBytecode, ethers.utils.hexZeroPad(context.mainModule, 32)])
    )
  
    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', context.factory, salt, codeHash])
    )
  
    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }

  if (salt.address && !ignoreAddress) return salt.address
  return addressOf(imageHash(salt), context)
}

export const imageHash = (config: WalletConfig): string => {
  config = sortConfig(config)

  const imageHash = config.signers.reduce(
    (imageHash, signer) => ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint8', 'address'],
        [imageHash, signer.weight, signer.address]
      )
    ),
    ethers.utils.solidityPack(['uint256'], [config.threshold])
  )

  cacheConfig(imageHash, config)

  return imageHash
}

// sortConfig normalizes the list of signer addreses in a WalletConfig
export const sortConfig = (config: WalletConfig): WalletConfig => {
  config.signers.sort((a, b) => compareAddr(a.address, b.address))

  // normalize
  config.signers.forEach(s => s.address = ethers.utils.getAddress(s.address))
  if (config.address) config.address = ethers.utils.getAddress(config.address)

  // ensure no duplicate signers in the config
  const signers = config.signers.map(s => s.address)
  const signerDupes = signers.filter((c, i) => signers.indexOf(c) !== i)
  if (signerDupes.length > 0) {
    throw new Error('invalid wallet config: duplicate signer addresses detected in the config, ${signerDupes}')
  }

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

export function editConfig(config: WalletConfig, args: {
  threshold?: ethers.BigNumberish,
  set?: { weight: ethers.BigNumberish, address: string }[],
  del?: { address: string }[]
}): WalletConfig {
  const normSigner = (s: { weight: ethers.BigNumberish, address: string }) => ({ weight: ethers.BigNumber.from(s.weight).toNumber(), address: ethers.utils.getAddress(s.address) })

  const normSrcSigners = config.signers.map(normSigner)

  const normSetSigners = args.set ? args.set.map(normSigner) : []
  const normDelAddress = args.del ? args.del.map((a) => ethers.utils.getAddress(a.address)) : []

  const normSetAddress = normSetSigners.map((s) => s.address)

  const newSigners = normSrcSigners
    .filter((s) => normDelAddress.indexOf(s.address) === -1 && normSetAddress.indexOf(s.address) === -1)
    .concat(...normSetSigners)

  return sortConfig({
    address: config.address,
    threshold: args.threshold ? ethers.BigNumber.from(args.threshold).toNumber() : config.threshold,
    signers: newSigners
  })
}

// TODO: very similar to createWalletConfig, but doesn't allow an AbstractSigner object
// TODO: lets also check isUsableConfig before returning it
export function genConfig(threshold: ethers.BigNumberish, signers: { weight: ethers.BigNumberish, address: string }[]): WalletConfig {
  return sortConfig({
    threshold: ethers.BigNumber.from(threshold).toNumber(),
    signers: signers.map((s) => ({ weight: ethers.BigNumber.from(s.weight).toNumber(), address: ethers.utils.getAddress(s.address) }))
  })
}

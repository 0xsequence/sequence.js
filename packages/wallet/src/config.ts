import { BigNumberish, BytesLike, ethers } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { WalletContractBytecode } from './bytecode'
import { SignerInfo, SignerThreshold, DecodedSignature, DecodedSigner, DecodedOwner } from './signer'

// WalletConfig is the configuration of key signers that can access
// and control the wallet
export interface WalletConfig {
  address?: string
  chainId?: number
  threshold: number
  signers: {
    weight: number
    address: string
  }[]
}

// TODO ......
export type GlobalWalletConfig = {
  threshold: SignerThreshold[],
  signers: SignerInfo[]
}

// TODO: and then remove GlobalWalletConfig type..
// export type GlobalWalletConfig = WalletConfig[]

export function isConfigEqual(a: WalletConfig, b: WalletConfig): boolean {
  return imageHash(a) === imageHash(b)
}

// sortConfig normalizes the list of signer addreses in a WalletConfig
export function sortConfig(config: WalletConfig): WalletConfig {
  config.signers.sort((a, b) => compareAddr(a.address, b.address))
  return config
}

export function compareAddr(a: string, b: string): number {
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

// isUsableConfig checks if a the sum of the owners in the configuration meets the necessary threshold to sign a transaction
// a wallet that has a non-usable configuration is not able to perform any transactions, and can be considered as destroyed
export function isUsableConfig(config: WalletConfig): boolean {
  const sum = config.signers.reduce((p, c) => ethers.BigNumber.from(c.weight).add(p), ethers.constants.Zero)
  return sum.gte(ethers.BigNumber.from(config.threshold))
}

export function imageHash(config: WalletConfig): string {
  let imageHash = ethers.utils.solidityPack(['uint256'], [config.threshold])

  config.signers.forEach(
    a =>
      (imageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint8', 'address'], [imageHash, a.weight, a.address])
      ))
  )

  return imageHash
}

export function addressOf(config: WalletConfig, context: WalletContext): string {
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

// recoverConfig decodes a WalletConfig from the subDigest and signature combo. Note: the subDigest argument
// is an encoding format of the original message, encoded by:
//
// subDigest = packMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
export function recoverConfig(subDigest: BytesLike, signature: string | DecodedSignature): WalletConfig {
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(subDigest))
  return recoverConfigFromDigest(digest, signature)
}

export function isSigner(obj: DecodedSigner | DecodedOwner): boolean {
  const cast = obj as DecodedSigner
  return cast.r !== undefined && cast.s !== undefined
}

// recoverConfigFromDigest decodes a WalletConfig from a digest and signature combo. Note: the digest
// is the keccak256 of the subDigest, see `recoverConfig` method.
export function recoverConfigFromDigest(digest: BytesLike, signature: string | DecodedSignature): WalletConfig {
  const decoded = (<DecodedSignature>signature).threshold !== undefined ? <DecodedSignature>signature : decodeSignature(signature as string)

  const signers = decoded.signers.map(s => {
    if (isSigner(s)) {
      return {
        weight: s.weight,
        address: recoverSigner(digest, s as DecodedSigner)
      }
    } else {
      return {
        weight: s.weight,
        address: (<DecodedOwner>s).address
      }
    }
  })

  return {
    threshold: decoded.threshold,
    signers: signers
  }
}

export function decodeSignature(signature: string): DecodedSignature {
  const auxsig = signature.replace('0x', '')

  const threshold = ethers.BigNumber.from(`0x${auxsig.slice(0, 4)}`).toNumber()

  const signers = []

  for (let rindex = 4; rindex < auxsig.length; ) {
    const isAddr = auxsig.slice(rindex, rindex + 2) !== '00'
    rindex += 2

    const weight = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
    rindex += 2

    if (isAddr) {
      const addr = ethers.utils.getAddress(auxsig.slice(rindex, rindex + 40))
      rindex += 40

      signers.push({
        weight: weight,
        address: addr
      })
    } else {
      const r = `0x${auxsig.slice(rindex, rindex + 64)}`
      rindex += 64

      const s = `0x${auxsig.slice(rindex, rindex + 64)}`
      rindex += 64

      const v = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
      rindex += 2

      const t = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
      rindex += 2

      signers.push({
        weight: weight,
        r: r,
        s: s,
        v: v,
        t: t
      })
    }
  }

  return {
    threshold: threshold,
    signers: signers
  }
}

const SIG_TYPE_EIP712 = 1
const SIG_TYPE_ETH_SIGN = 2

export function recoverSigner(digest: BytesLike, sig: DecodedSigner) {
  switch (sig.t) {
    case SIG_TYPE_EIP712:
      return ethers.utils.recoverAddress(digest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    case SIG_TYPE_ETH_SIGN:
      const subDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['string', 'bytes32'],
          ['\x19Ethereum Signed Message:\n32', digest]
        )
      )

      return ethers.utils.recoverAddress(subDigest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    default:
      throw new Error('Unknown signature')
  }
}

export function joinSignatures(...signatures: string[]) {
  return signatures.reduce((p, c) => joinTwoSignatures(p, c))
}

export function joinTwoSignatures(a: string, b: string): string {
  const da = decodeSignature(a)
  const db = decodeSignature(b)

  const signers = da.signers.map((s, i) => ((<DecodedSigner>s).r ? s : db.signers[i]))

  const accountBytes = signers.map(s => {
    if ((<DecodedSigner>s).r) {
      const sig = s as DecodedSigner
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [false, s.weight, sig.r, sig.s, sig.v, sig.t]
      )
    } else {
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'address'],
        [true, s.weight, ethers.utils.getAddress((<DecodedOwner>s).address)]
      )
    }
  })

  return ethers.utils.solidityPack(['uint16', ...Array(accountBytes.length).fill('bytes')], [da.threshold, ...accountBytes])
}

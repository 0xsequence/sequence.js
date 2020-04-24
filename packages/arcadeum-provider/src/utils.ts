import { ArcadeumWalletConfig, ArcadeumContext, ArcadeumDecodedSignature, ArcadeumDecodedOwner, ArcadeumDecodedSigner, ArcadeumTransaction } from "./types"
import { ethers } from "ethers"
import * as WalletContract from "./commons/wallet_contract"
import { BigNumberish, Arrayish, Interface } from "ethers/utils"
import { TransactionRequest } from "ethers/providers"
import { Wallet } from "./wallet"

const ModuleCreator = require("arcadeum-wallet/build/contracts/ModuleCreator.json")


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

export function addressOf(
  config: ArcadeumWalletConfig,
  context: ArcadeumContext
): string {
  const salt = imageHash(config)

  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [WalletContract.code, ethers.utils.hexZeroPad(context.mainModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', context.factory, salt, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

export const MetaTransactionsType = `tuple(
  bool delegateCall,
  bool revertOnError,
  uint256 gasLimit,
  address target,
  uint256 value,
  bytes data
)[]`

export function hashMetaTransactionsData(
  wallet: string,
  nonce: BigNumberish,
  ...txs: ArcadeumTransaction[]
): string {
  const transactions = ethers.utils.defaultAbiCoder.encode(
    ['uint256', MetaTransactionsType],
    [nonce, txs]
  )

  return ethers.utils.solidityPack(
    ['string', 'address', 'bytes'],
    ['\x19\x01', wallet, ethers.utils.keccak256(transactions)]
  )
}

export function recoverConfig(message: Arrayish, signature: string): ArcadeumWalletConfig {
  const decoded = decodeSignature(signature)
  const digest = ethers.utils.keccak256(message)

  const signers = decoded.signers.map((s) => {
    if ((<ArcadeumDecodedSigner>s).r) {
      const sig = <ArcadeumDecodedSigner>s
      return {
        weight: sig.weight,
        address: ethers.utils.recoverAddress(digest, { r: sig.r, s: sig.s, v: sig.v })
      }
    } else {
      return {
        weight: s.weight,
        address: (<ArcadeumDecodedOwner>s).address
      }
    }
  })

  return {
    threshold: decoded.threshold,
    signers: signers
  }
}

export function decodeSignature(signature: string): ArcadeumDecodedSignature {
  const auxsig = signature.replace('0x', '')

  const threshold = ethers.utils.bigNumberify(auxsig.slice(0, 4)).toNumber()

  const signers = []

  for (let rindex = 4; rindex < auxsig.length;) {
    const isAddr = auxsig.slice(rindex, rindex + 2) === '00'
    rindex += 2

    const weight = ethers.utils.bigNumberify(auxsig.slice(rindex, rindex + 2)).toNumber()
    rindex += 2

    if (isAddr) {
      const addr = ethers.utils.hexZeroPad(auxsig.slice(rindex, rindex + 40), 32)
      rindex += 40

      signers.push({
        weight: weight,
        address: addr
      })
    } else {
      const r = auxsig.slice(rindex, rindex + 64)
      rindex += 64

      const s = auxsig.slice(rindex, rindex + 64)
      rindex += 64

      const v = ethers.utils.bigNumberify(auxsig.slice(rindex, rindex + 2)).toNumber()
      rindex += 2

      const t = ethers.utils.bigNumberify(auxsig.slice(rindex, rindex + 2)).toNumber()
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

export function aggregate(...signatures: string[]) {
  return signatures.reduce((p, c) => aggregateTwo(p, c))
}

function aggregateTwo(a: string, b: string): string{
  const da = decodeSignature(a)
  const db = decodeSignature(b)

  const signers = da.signers.map((s, i) => (<ArcadeumDecodedSigner>s).r ? s : db[i])

  const accountBytes = signers.map((s) => {
    if (<ArcadeumDecodedSigner>s.r) {
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [false, s.weight, s.r, s.s, s.v, s.t]
      )
    } else {
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'address'],
        [true, s.weight, s.address]
      )
    }
  })

  return ethers.utils.solidityPack(
    ['uint16', ...Array(this._config.signers.length).fill('bytes')],
    [da.threshold, ...accountBytes]
  )
}

export async function toArcadeumTransaction(
  wallet: Wallet,
  tx: TransactionRequest, 
  revertOnError: boolean = false,
  gasLimit: BigNumberish = 10000000
): Promise<ArcadeumTransaction> {
  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit ? await tx.gasLimit : gasLimit,
      target: await tx.to,
      value: tx.value ? await tx.value : 0,
      data: await tx.data
    }
  } else {
    const walletInterface = new Interface(ModuleCreator.abi)
    const data = walletInterface.functions.createContract.encode([tx.data])
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit ? await tx.gasLimit : gasLimit,
      target: wallet.address,
      value: tx.value ? await tx.value : 0,
      data: data
    }
  }
}

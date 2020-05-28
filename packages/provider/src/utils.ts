import {
  ArcadeumWalletConfig,
  ArcadeumContext,
  ArcadeumDecodedSignature,
  ArcadeumDecodedOwner,
  ArcadeumDecodedSigner,
  ArcadeumTransaction,
  ArcadeumTransactionEncoded,
  AuxTransactionRequest,
  Transactionish
} from './types'

import { ethers, Signer } from 'ethers'
import * as WalletContract from './commons/wallet_contract'
import { BigNumberish, Arrayish, Interface } from 'ethers/utils'
import { TransactionRequest, Provider } from 'ethers/providers'
import { abi as mainModuleAbi } from './abi/mainModule'
import { abi as erc1271Abi, returns as erc1271returns } from './abi/erc1271'

export function compareAddr(a: string, b: string): number {
  const bigA = ethers.utils.bigNumberify(a)
  const bigB = ethers.utils.bigNumberify(b)

  if (bigA.lt(bigB)) {
    return -1
  } else if (bigA.eq(bigB)) {
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

  config.signers.forEach(
    a =>
      (imageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint8', 'address'], [imageHash, a.weight, a.address])
      ))
  )

  return imageHash
}

export function addressOf(config: ArcadeumWalletConfig, context: ArcadeumContext): string {
  const salt = imageHash(config)

  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(['bytes', 'bytes32'], [WalletContract.code, ethers.utils.hexZeroPad(context.mainModule, 32)])
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', context.factory, salt, codeHash])
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

export function hashMetaTransactionsData(wallet: string, networkId: BigNumberish, ...txs: ArcadeumTransaction[]): string {
  const nonce = readArcadeumNonce(...txs)
  const transactions = ethers.utils.defaultAbiCoder.encode(['uint256', MetaTransactionsType], [nonce, arcadeumTxAbiEncode(txs)])

  return encodeMessageData(wallet, networkId, transactions)
}

export function encodeMessageData(wallet: string, networkId: BigNumberish, data: string): string {
  return ethers.utils.solidityPack(
    ['string', 'uint256', 'address', 'bytes'],
    ['\x19\x01', networkId, wallet, ethers.utils.keccak256(data)]
  )
}

const SignatureType1271 = {
  invalid: 0,
  eip712: 1,
  ethSign: 2
}

const SignatureType2126 = {
  illegal: 0,
  invalid: 1,
  eip712: 2,
  ethSign: 3,
  wallet: 4
}

function recoverSigner(digest: Arrayish, sig: ArcadeumDecodedSigner) {
  switch (sig.t) {
    case SignatureType1271.eip712:
      return ethers.utils.recoverAddress(digest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    case SignatureType1271.ethSign:
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

function decodeEOASig(sig: Buffer): { r: string, s: string, v: number} {
  const v = ethers.utils.bigNumberify(sig.slice(0, 1)).toNumber()
  const r = ethers.utils.hexlify(sig.slice(1, 33))
  const s = ethers.utils.hexlify(sig.slice(33, 65))
  return { r: r, s: s, v: v}
}

function addressCompare(a: string, b: string) {
  const an = ethers.utils.bigNumberify(a)
  const bn = ethers.utils.bigNumberify(b)
  return an.eq(bn)
}

export async function isValidSignature(
  address: string,
  digest: Arrayish,
  sig: Buffer,
  provider?: Provider,
  arcadeumContext?: ArcadeumContext
) {
  const type = ethers.utils.bigNumberify(sig.slice(-2)).toNumber()
  switch (type) {
    case SignatureType2126.illegal:
      throw new Error('Invalid signature type')

    case SignatureType2126.invalid:
      return false

    case SignatureType2126.eip712:
      return addressCompare(ethers.utils.recoverAddress(digest, decodeEOASig(sig)), address)

    case SignatureType2126.ethSign:
      const ethSignDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['string', 'bytes32'],
          ['\x19Ethereum Signed Message:\n32', digest]
        )
      )
      return addressCompare(ethers.utils.recoverAddress(ethSignDigest, decodeEOASig(sig)), address)

    case SignatureType2126.wallet:
      if (!provider) throw new Error('Wallet signatures require RPC Provider')

      if ((await provider.getCode(address)) === '0x') {
        if (!arcadeumContext) new Error('Presumed non-deployed arcadeum wallet, but no context provided')
      } else {
        const wallet = new ethers.Contract(address, erc1271Abi, provider)
        const response = await wallet.isValidSignature(digest, sig.slice(0, -2))
        return erc1271returns.isValidSignatureBytes32 === response
      }
  }
}

export function recoverConfig(message: Arrayish, signature: string): ArcadeumWalletConfig {
  const decoded = decodeSignature(signature)
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

  const signers = decoded.signers.map(s => {
    if ((<ArcadeumDecodedSigner>s).r) {
      return {
        weight: s.weight,
        address: recoverSigner(digest, s as ArcadeumDecodedSigner)
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
  const auxsig = signature.replace('0x', '').slice(0, -2)

  const threshold = ethers.utils.bigNumberify(auxsig.slice(0, 4)).toNumber()

  const signers = []

  for (let rindex = 4; rindex < auxsig.length; ) {
    const isAddr = auxsig.slice(rindex, rindex + 2) !== '00'
    rindex += 2

    const weight = ethers.utils.bigNumberify(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
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

      const v = ethers.utils.bigNumberify(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
      rindex += 2

      const t = ethers.utils.bigNumberify(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
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

function aggregateTwo(a: string, b: string): string {
  const da = decodeSignature(a)
  const db = decodeSignature(b)

  const signers = da.signers.map((s, i) => ((<ArcadeumDecodedSigner>s).r ? s : db.signers[i]))

  const accountBytes = signers.map(s => {
    if ((<ArcadeumDecodedSigner>s).r) {
      const sig = s as ArcadeumDecodedSigner
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [false, s.weight, sig.r, sig.s, sig.v, sig.t]
      )
    } else {
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'address'],
        [true, s.weight, ethers.utils.getAddress((<ArcadeumDecodedOwner>s).address)]
      )
    }
  })

  return ethers.utils.solidityPack(
    ['uint16', ...Array(accountBytes.length).fill('bytes')],
    [da.threshold, ...accountBytes]
  ) + '04'
}

export async function toArcadeumTransactions(
  wallet: Signer | string,
  txs: (ArcadeumTransaction | AuxTransactionRequest)[],
  revertOnError: boolean = false,
  gasLimit: BigNumberish = 10000000
): Promise<ArcadeumTransaction[]> {
  // Bundles all transactions, including the auxiliary ones
  const allTxs = flattenAuxTransactions(txs)

  // Uses the lowest nonce found on TransactionRequest
  // if there are no nonces, it leaves an undefined nonce
  const nonces = (await Promise.all(txs.map(t => t.nonce))).filter(n => n !== undefined).map(n => ethers.utils.bigNumberify(n))
  const nonce = nonces.length !== 0 ? nonces.reduce((p, c) => (p.lt(c) ? p : c)) : undefined

  // Maps all transactions into ArcadeumTransactions
  return Promise.all(allTxs.map(tx => toArcadeumTransaction(wallet, tx, revertOnError, gasLimit, nonce)))
}

export function flattenAuxTransactions(txs: (Transactionish | Transactionish)[]): (TransactionRequest | ArcadeumTransaction)[] {
  if (!Array.isArray(txs)) return flattenAuxTransactions([txs])
  return txs.reduce(function (p: Transactionish[], c: Transactionish) {
    if (Array.isArray(c)) {
      return p.concat(flattenAuxTransactions(c))
    }

    if ((<AuxTransactionRequest>c).auxiliary) {
      return p.concat([c, ...flattenAuxTransactions((<AuxTransactionRequest>c).auxiliary)])
    }

    return p.concat(c)
  }, []) as (TransactionRequest | ArcadeumTransaction)[]
}

export async function toArcadeumTransaction(
  wallet: Signer | string,
  tx: TransactionRequest | ArcadeumTransaction,
  revertOnError: boolean = false,
  gasLimit: BigNumberish = 10000000,
  nonce: BigNumberish = undefined
): Promise<ArcadeumTransaction> {
  if (isArcadeumTransaction(tx)) {
    return tx as ArcadeumTransaction
  }

  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit ? await tx.gasLimit : gasLimit,
      to: await tx.to,
      value: tx.value ? await tx.value : 0,
      data: await tx.data,
      nonce: nonce ? nonce : await tx.nonce
    }
  } else {
    const walletInterface = new Interface(mainModuleAbi)
    const data = walletInterface.functions.createContract.encode([tx.data])
    const address = typeof wallet === 'string' ? wallet : wallet.getAddress()

    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit ? await tx.gasLimit : gasLimit,
      to: await address,
      value: tx.value ? await tx.value : 0,
      data: data,
      nonce: nonce ? nonce : await tx.nonce
    }
  }
}

export function isAsyncSendable(target: any) {
  return target.send || target.sendAsync
}

export function isArcadeumTransaction(tx: any) {
  return tx.delegateCall !== undefined || tx.revertOnError !== undefined
}

export function hasArcadeumTransactions(txs: any[]) {
  return txs.find(t => isArcadeumTransaction(t)) !== undefined
}

export function readArcadeumNonce(...txs: ArcadeumTransaction[]): BigNumberish {
  const sample = txs.find(t => t.nonce !== undefined)
  if (txs.find(t => t.nonce !== undefined && t.nonce !== sample.nonce)) {
    throw Error('Mixed nonces on Arcadeum transactions')
  }

  return sample ? sample.nonce : undefined
}

export function arcadeumTxAbiEncode(txs: ArcadeumTransaction[]): ArcadeumTransactionEncoded[] {
  return txs.map(t => ({
    delegateCall: t.delegateCall,
    revertOnError: t.revertOnError,
    gasLimit: t.gasLimit,
    target: t.to,
    value: t.value,
    data: t.data
  }))
}

export function appendNonce(txs: ArcadeumTransaction[], nonce: BigNumberish): ArcadeumTransaction[] {
  return txs.map((t: ArcadeumTransaction) => ({ ...t, nonce }))
}

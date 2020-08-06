import {
  ArcadeumWalletConfig,
  ArcadeumContext,
  ArcadeumDecodedSignature,
  ArcadeumDecodedOwner,
  ArcadeumDecodedSigner,
  ArcadeumTransaction,
  ArcadeumTransactionEncoded,
  AuxTransactionRequest,
  Transactionish,
  NonceDependency
} from './types'
import { ethers, Signer } from 'ethers'
import * as WalletContract from './commons/wallet_contract'
import { BigNumberish, Arrayish, Interface } from 'ethers/utils'
import { TransactionRequest, Provider } from 'ethers/providers'
import { abi as mainModuleAbi } from './abi/mainModule'
import { abi as erc1271Abi, returns as erc1271returns } from './abi/erc1271'
import { abi as requireUtilsAbi } from './abi/requireUtils'
import { util } from 'chai'

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

// isUsableConfig checks if a the sum of the owners in the configuration meets the necessary threshold to sign a transaction
// a wallet that has a non-usable configuration is not able to perform any transactions, and can be considered as destroyed
export function isUsableConfig(config: ArcadeumWalletConfig): boolean {
  const sum = config.signers.reduce((p, c) => ethers.utils.bigNumberify(c.weight).add(p), ethers.constants.Zero)
  return sum.gte(ethers.utils.bigNumberify(config.threshold))
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
  if (config.address) return config.address

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

  return encodeMessageData(wallet, networkId, ethers.utils.keccak256(transactions))
}

export function encodeMessageData(wallet: string, networkId: BigNumberish, digest: Arrayish): string {
  return ethers.utils.solidityPack(
    ['string', 'uint256', 'address', 'bytes32'],
    ['\x19\x01', networkId, wallet, digest]
  )
}

const SIG_TYPE_EIP712 = 1
const SIG_TYPE_ETH_SIGN = 2

function recoverSigner(digest: Arrayish, sig: ArcadeumDecodedSigner) {
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

export async function isValidSignature(
  address: string,
  digest: Uint8Array,
  sig: string,
  provider?: Provider,
  arcadeumContext?: ArcadeumContext,
  chainId?: number
) {
  if (
    isValidEIP712Signature(address, digest, sig) ||
    isValidEthSignSignature(address, digest, sig)
  ) return true

  const wallets = await Promise.all([
    isValidWalletSignature(address, digest, sig, provider),
    isValidArcadeumDeployedWalletSignature(address, digest, sig, provider, chainId)
  ])

  // If validity of wallet signature can't be determined
  // it could be a signature of a non-deployed arcadeum wallet
  if (wallets[0] === undefined && wallets[1] === undefined) {
    return isValidArcadeumUndeployedWalletSignature(address, digest, sig, arcadeumContext, provider, chainId)
  }

  return wallets[0] || wallets[1]
}

export function isValidEIP712Signature(
  address: string,
  digest: Uint8Array,
  sig: string
): boolean {
  try {
    return compareAddr(
      ethers.utils.recoverAddress(
        digest,
        ethers.utils.splitSignature(sig)
      ),
      address
    ) === 0
  } catch {
    return false
  }
}

export function isValidEthSignSignature(
  address: string,
  digest: Uint8Array,
  sig: string
): boolean {
  try {
    const subDigest = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['string', 'bytes32'],
        ['\x19Ethereum Signed Message:\n32', digest]
      )
    )
    return compareAddr(
      ethers.utils.recoverAddress(
        subDigest,
        ethers.utils.splitSignature(sig)
      ),
      address
    ) === 0
  } catch {
    return false
  }
}

export async function isValidWalletSignature(
  address: string,
  digest: Uint8Array,
  sig: string,
  provider?: Provider
) {
  if (!provider) return undefined
  try {
    if ((await provider.getCode(address)) === '0x') {
      // Signature validity can't be determined
      return undefined
    }

    const wallet = new ethers.Contract(address, erc1271Abi, provider)
    const response = await wallet.isValidSignature(digest, sig)
    return erc1271returns.isValidSignatureBytes32 === response
  } catch {
    return false
  }
}

export async function isValidArcadeumDeployedWalletSignature(
  address: string,
  digest: Uint8Array,
  sig: string,
  provider?: Provider,
  chainId?: number
) {
  if (!provider) return undefined // Signature validity can't be determined
  try {
    const cid = chainId ? chainId : (await provider.getNetwork()).chainId
    const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(encodeMessageData(address, cid, digest)))
    return isValidWalletSignature(address, subDigest, sig, provider)
  } catch {
    return false
  }
}

export async function isValidArcadeumUndeployedWalletSignature(
  address: string,
  digest: Uint8Array,
  sig: string,
  arcadeumContext?: ArcadeumContext,
  provider?: Provider,
  chainId?: number
) {
  if (!provider && !chainId) return undefined // Signature validity can't be determined
  if (!arcadeumContext) return undefined // Signature validity can't be determined

  try{
    const cid = chainId ? chainId : (await provider.getNetwork()).chainId
    const signature = decodeSignature(sig)
    const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(encodeMessageData(address, cid, digest)))
    const config = recoverConfigFromDigest(subDigest, signature)
    const weight = signature.signers.reduce((v, s) => isSigner(s) ? v + s.weight : v, 0)
    return compareAddr(addressOf(config, arcadeumContext), address) === 0 && weight >= signature.threshold
  } catch {
    return false
  }
}

export function recoverConfig(message: Arrayish, signature: string | ArcadeumDecodedSignature): ArcadeumWalletConfig {
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))
  return recoverConfigFromDigest(digest, signature)
}

export function isSigner(obj: ArcadeumDecodedSigner | ArcadeumDecodedOwner): boolean {
  const cast = obj as ArcadeumDecodedSigner
  return cast.r !== undefined && cast.s != undefined
}

export function recoverConfigFromDigest(digest: Arrayish, signature: string | ArcadeumDecodedSignature): ArcadeumWalletConfig {
  const decoded = (<ArcadeumDecodedSignature>signature).threshold !== undefined ? <ArcadeumDecodedSignature>signature : decodeSignature(signature as string)

  const signers = decoded.signers.map(s => {
    if (isSigner(s)) {
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
  const auxsig = signature.replace('0x', '')

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

  return ethers.utils.solidityPack(['uint16', ...Array(accountBytes.length).fill('bytes')], [da.threshold, ...accountBytes])
}

export async function toArcadeumTransactions(
  wallet: Signer | string,
  txs: (ArcadeumTransaction | AuxTransactionRequest)[],
  revertOnError: boolean = false,
  gasLimit: BigNumberish = ethers.constants.Zero
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
  gasLimit: BigNumberish = ethers.constants.Zero,
  nonce: BigNumberish = undefined
): Promise<ArcadeumTransaction> {
  if (isArcadeumTransaction(tx)) {
    return tx as ArcadeumTransaction
  }

  const txGas = tx.gasLimit === undefined ? (<any>tx).gas : tx.gasLimit

  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: txGas ? await txGas : gasLimit,
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
      gasLimit: txGas ? await txGas : gasLimit,
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

export function makeExpirable(context: ArcadeumContext, txs: ArcadeumTransaction[], expiration: BigNumberish): ArcadeumTransaction[] {
  const requireUtils = new Interface(requireUtilsAbi)

  if (!context || !context.requireUtils) {
    throw new Error('Undefined requireUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.requireUtils,
      value: 0,
      data: requireUtils.functions.requireNonExpired.encode([expiration])
    },
    ...txs
  ]
}

export function makeAfterNonce(context: ArcadeumContext, txs: ArcadeumTransaction[], dep: NonceDependency): ArcadeumTransaction[] {
  const requireUtils = new Interface(requireUtilsAbi)

  if (!context || !context.requireUtils) {
    throw new Error('Undefined requireUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.requireUtils,
      value: 0,
      data: requireUtils.functions.requireMinNonce.encode([
        dep.address,
        dep.space ? encodeNonce(dep.space, dep.nonce) : dep.nonce
      ])
    },
    ...txs
  ]
}

export function encodeNonce(space: BigNumberish, nonce: BigNumberish): BigNumberish {
  const bspace = ethers.utils.bigNumberify(space)
  const bnonce = ethers.utils.bigNumberify(nonce)

  const shl = ethers.constants.Two.pow(ethers.utils.bigNumberify(96))

  if (!bnonce.div(shl).eq(ethers.constants.Zero)) {
    throw new Error('Space already encoded')
  }

  return bnonce.add(bspace.mul(shl))
}

export function decodeNonce(nonce: BigNumberish): [BigNumberish, BigNumberish] {
  const bnonce = ethers.utils.bigNumberify(nonce)
  const shr = ethers.constants.Two.pow(ethers.utils.bigNumberify(96))

  return [
    bnonce.div(shr),
    bnonce.mod(shr)
  ]
}

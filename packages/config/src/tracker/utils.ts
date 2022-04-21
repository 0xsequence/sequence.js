import { walletContracts } from "@0xsequence/abi"
import { Transaction } from "@0xsequence/transactions"
import { imageHash, isAddrEqual, WalletConfig } from ".."
import { ethers } from "ethers"
import { WalletContext } from "@0xsequence/network"
import { Interface } from 'ethers/lib/utils'
import { startsWith } from "@0xsequence/utils"

export const SESSIONS_SPACE = "861879107978547650890364157709704413515112855535"

export function isValidWalletUpdate(args: {
    wallet: string,
    newConfig: WalletConfig | string,
    context: WalletContext,
    txs: Transaction[],
    gapNonce: ethers.BigNumber,
  }): boolean {
  const { wallet, newConfig, context, txs, gapNonce } = args

  // Only batches with 2 or 3 transactions are valid
  switch (txs.length) {
    case 3:
      // 3 transactions means it should be updateImplementation + updateImageHash + sessionNonce
      if (!isUpdateImplementationTx(wallet, context.mainModuleUpgradable, txs[0])) {
        return false
      }

      if (!isUpdateImageHashTx(wallet, newConfig, txs[1])) {
        return false
      }

      if (!isSessionNonceTx(gapNonce, context, txs[2])) {
        return false
      }
      break
    case 2:
      // 2 transactions means it should be updateImageHash + sessionNonce
      if (!isUpdateImageHashTx(wallet, newConfig, txs[0])) {
        return false
      }

      if (!isSessionNonceTx(gapNonce, context, txs[1])) {
        return false
      }
      break
    default:
      return false
  }

  return true
}

export function isUpdateImplementationTx(wallet: string, target: string, tx: Transaction): boolean {
  const mainModuleInterface = new Interface(walletContracts.mainModule.abi)

  // First 4 bytes should be the updateImplementation signature
  if (!startsWith(tx.data, mainModuleInterface.getSighash("updateImplementation"))) {
    return false
  }

  // Target of transactions should be the wallet
  if (!isAddrEqual(tx.to, wallet)) {
    return false
  }

  // Decode arguments of method call
  try {
    const decoded = tx.data && mainModuleInterface.decodeFunctionData("updateImplementation", tx.data)
    if (!decoded) return false
  
    // Decoded implementation should match target
    if (!isAddrEqual(decoded[0], target)) {
      return false
    }
  } catch {}

  return true
}

export function getUpdateImplementation(tx: Transaction): string | undefined {
  const mainModuleInterface = new Interface(walletContracts.mainModule.abi)

  // First 4 bytes should be the setImageHash signature
  if (!startsWith(tx.data, mainModuleInterface.getSighash("updateImplementation"))) {
    return undefined
  }

  // Decode arguments of method call
  try {
    const decoded = tx.data && mainModuleInterface.decodeFunctionData("updateImplementation", tx.data)
    if (!decoded) return undefined
  
    return decoded[0]
  } catch {}

  return undefined
}

export function isUpdateImageHashTx(wallet: string, config: WalletConfig | string, tx: Transaction): boolean {
  const mainModuleUpgradableInterface = new Interface(walletContracts.mainModuleUpgradable.abi)

  // First 4 bytes should be the setImageHash signature
  if (!startsWith(tx.data, mainModuleUpgradableInterface.getSighash("updateImageHash"))) {
    return false
  }

  // Target of transaction should be the wallet
  if (tx.to.toLowerCase() !== wallet.toLowerCase()) {
    return false
  }

  // Decode arguments of method call
  try {
    const decoded = tx.data && mainModuleUpgradableInterface.decodeFunctionData("updateImageHash", tx.data)
    if (!decoded) return false
  
    // Decoded image hash should match config
    if (decoded[0] !== (typeof config === "string" ? config : imageHash(config))) {
      return false
    }
  } catch {}

  return true
}

export function isSessionNonceTx(nonce: ethers.BigNumberish, context: WalletContext, tx: Transaction): boolean {
  const sessionInterface = new Interface(walletContracts.sessionUtils.abi)

  // First 4 bytes should be requireSessionNonce signature
  if (!startsWith(tx.data, sessionInterface.getSighash("requireSessionNonce"))) {
    return false
  }

  // Target of transaction should be the sessionUtils
  // specified in the context
  if (tx.to.toLowerCase() !== context.sessionUtils.toLowerCase()) {
    return false
  }

  // Decode arguments of method call
  try {
    const decoded = tx.data && sessionInterface.decodeFunctionData("requireSessionNonce", tx.data)
    if (!decoded) return false
  
    // Decoded nonce should match provided nonce
    if (!ethers.BigNumber.from(nonce).eq(decoded[0])) {
      return false
    }
  } catch {}

  return true
}

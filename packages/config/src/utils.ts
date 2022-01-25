import { walletContracts } from "@0xsequence/abi"
import { unpackMetaTransactionData } from "@0xsequence/transactions"
import { ethers } from "ethers"
import { Interface } from "ethers/lib/utils"
import { PresignedConfigUpdate } from "./tracker/config-tracker"

export async function PromiseAny <T>(promises: Promise<T>[]): Promise<T> {
  let errors = 0

  return new Promise<T>((resolve, reject) => {
    promises.forEach((promise) => {
      promise.then(resolve).catch((error) => {
        errors++

        if (errors === promises.length) {
          reject(error)
        }
      })
    })
  })
}

export async function PromiseSome <T>(promises: Promise<T | undefined>[]): Promise<T | undefined> {
  let ignoring = 0

  return new Promise<T | undefined>((resolve) => {
    const ignore = () => {
      ignoring++

      if (ignoring === promises.length) {
        resolve(undefined)
      }
    }

    promises.forEach((promise) => {
      promise.then((res) => {
        if (res !== undefined) {
          resolve(res)
        } else {
          ignore()
        }
      }).catch(ignore)
    })
  })
}

// Returns true if one of the provided presigned transactions
// contains an `updateImplementation` with the given `implementation`
export function hasImplementationUpdate(presigned: PresignedConfigUpdate[], wallet: string, implementation: string): boolean {
  const updateImplementationPrefix = new Interface(walletContracts.mainModule.abi).getSighash("updateImplementation")
  const walletLowerCase = ethers.utils.getAddress(wallet)
  const implementationLowerCase = implementation.toLowerCase()

  for (const update of presigned) {
    const decoded = unpackMetaTransactionData(update.body.tx)
    const hexData = ethers.utils.hexlify(decoded[0].data)

    // Check if is an updateImplementation transaction
    // TODO: Move this to a common util that also validates data
    // provided by the config tracker
    if (
      // Presigned transaction should have 3 subtransactions
      decoded.length === 3 &&
      // Calldata lenght should be 32 + 4 bytes
      ethers.utils.arrayify(decoded[0].data).length === 36 &&
      // Calldata of first subtransaction should begin with
      // updateImplementation call
      hexData.startsWith(updateImplementationPrefix) &&
      // Calldata of first transaction should end with
      // the implementation address
      hexData.endsWith(implementationLowerCase) &&
      // Target of subtransaction should be wallet
      decoded[0].to.toLowerCase() === walletLowerCase &&
      ethers.constants.Zero.eq(decoded[0].value) &&
      ethers.constants.Zero.eq(decoded[0].gasLimit) &&
      !decoded[0].delegateCall &&
      decoded[0].revertOnError
    ) {
      return true
    }
  }

  return false
}
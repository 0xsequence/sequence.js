import { walletContracts } from "@0xsequence/abi"
import { unpackMetaTransactionData } from "@0xsequence/transactions"
import { ethers } from "ethers"
import { Interface } from "ethers/lib/utils"
import { isUpdateImplementationTx } from "."
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
  for (const update of presigned) {
    const decoded = unpackMetaTransactionData(update.body.tx)

    // Check if is an updateImplementation transaction
    if (decoded.length == 3 && isUpdateImplementationTx(wallet, implementation, decoded[0])) {
      return true
    }
  }

  return false
}
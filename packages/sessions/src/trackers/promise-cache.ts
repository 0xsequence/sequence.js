import { ethers } from 'ethers'

export class PromiseCache {
  private readonly cache: Map<string, Entry>

  constructor() {
    this.cache = new Map()
  }

  do<S extends Array<unknown>, T>(
    key: string,
    validMilliseconds: number | undefined,
    task: (...args: S) => Promise<T>,
    ...args: S
  ): Promise<T> {
    key = `${key}:${ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(args)))}`

    let entry = this.cache.get(key)

    if (entry) {
      if (entry.expiration) {
        if (new Date() >= entry.expiration) {
          entry = undefined
          this.cache.delete(key)
        }
      }
    }

    if (!entry) {
      if (validMilliseconds === undefined) {
        entry = { promise: task(...args) }
      } else {
        entry = { promise: task(...args).then(result => {
            if (entry) {
              entry.expiration = new Date(Date.now() + validMilliseconds)
            }
            return result
          })
        }
      }
      this.cache.set(key, entry)
    }

    return entry.promise as Promise<T>
  }
}

type Entry = {
  promise: Promise<unknown>
  expiration?: Date
}

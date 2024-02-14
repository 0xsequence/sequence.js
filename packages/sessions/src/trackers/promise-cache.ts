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
    key = `${key}:${ethers.id(JSON.stringify(args, deterministically))}`

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
      const entry_: Entry = { promise: task(...args) }

      if (validMilliseconds !== undefined) {
        entry_.promise = entry_.promise.then(result => {
          entry_.expiration = new Date(Date.now() + validMilliseconds)
          return result
        })
      }

      entry = entry_
      this.cache.set(key, entry)
    }

    return entry.promise as Promise<T>
  }
}

type Entry = {
  promise: Promise<unknown>
  expiration?: Date
}

function deterministically(_key: string, value: any): any {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).sort())
  } else if (typeof value === 'bigint') {
    return value.toString()
  }

  return value
}

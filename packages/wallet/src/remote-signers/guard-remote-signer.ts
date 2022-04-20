import fetchPonyfill from 'fetch-ponyfill'
import { BigNumber, ethers, BytesLike } from 'ethers'
import { RemoteSigner } from './remote-signer'
import { Guard } from '@0xsequence/guard'
import { ChainId, ChainIdLike } from '@0xsequence/network'

type QueueEntry = {
  message: string,
  auxData: string,
  chainId: ethers.BigNumber
  resolve: (result: string) => void,
  reject: (error: Error) => void
}

export class GuardRemoteSigner extends RemoteSigner {
  private readonly _guardd: Guard
  private readonly _address: string
  private readonly _defaultChainIdBn

  private timeout: NodeJS.Timeout | undefined
  private queue = [] as QueueEntry[]

  constructor(
    address: string,
    hostname: string,
    public isSequence: boolean = false,
    public defaultChainId: number = ChainId.MAINNET
  ) {
    super()
    this._guardd = new Guard(hostname, fetchPonyfill().fetch)
    this._address = address
    this._defaultChainIdBn = BigNumber.from(defaultChainId)
  }

  scheduleExecution = () => {
    if (this.queue.length > 0) {
      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = setTimeout(this.run, 50)
    }
  }

  async run() {
    // Copy queue to local variable
    const queue = [...this.queue]
    this.queue = []

    // Partition queue into batches with same message
    const batches = {} as { [key: string]: QueueEntry[] }
    for (const entry of queue) {
      const key = ethers.utils.hexlify(entry.message)
      if (!batches[key]) batches[key] = []
      batches[key].push(entry)
    }

    // Send batches to guardd
    for (const entries of Object.values(batches)) {
      // If there is only one entry, just send it
      if (entries.length === 1) {
        const entry = entries[0]
        const request = {
          msg: entry.message,
          auxData: entry.auxData,
          chainId: entry.chainId.toNumber()
        }

        const res = await this._guardd.sign({ request })
        entry.resolve(this.isSequence ? res.sig : res.sig + '02')
      } else {
        // If not, sign in batch
        // Sort by chainId from lowest to highest
        const sortedEntries = entries.sort((a, b) => a.chainId.lt(b.chainId) ? -1 : 1)

        // Send request with auxData of the first chainId
        const request = {
          msg: sortedEntries[0].message,
          auxData: sortedEntries[0].auxData,
        }

        const chainIds = sortedEntries.map(entry => entry.chainId.toString())
        const res = await this._guardd.batchSign({ request, chainIds })

        // Resolve all entries, responses are provided in the same order
        for (const [i, entry] of sortedEntries.entries()) {
          entry.resolve(this.isSequence ? res.sig[i] : res.sig[i] + '02')
        }
      }
    }
  }

  async signMessageWithData(message: BytesLike, auxData?: BytesLike, chainId?: ChainIdLike): Promise<string> {
    // Create new promise and add entry to queue
    return new Promise<string>((resolve, reject) => {
      this.queue.push({
        message: ethers.utils.hexlify(message),
        auxData: ethers.utils.hexlify(auxData || []),
        chainId: chainId ? BigNumber.from(chainId) : this._defaultChainIdBn,
        resolve,
        reject
      })
    })
  }

  async getAddress(): Promise<string> {
    return this._address
  }
}

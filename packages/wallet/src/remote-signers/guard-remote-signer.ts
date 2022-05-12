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
      this.timeout = setTimeout(() => this.run(), 250)
    }
  }

  async run() {
    // Copy queue to local variable
    const queue = [...this.queue]
    this.queue = []

    const batches: {[key: string]: QueueEntry[]} = {}

    // Group queue entries by same msg + wallet
    for (const entry of queue) {
      // Decode auxData

      // TODO: this could be simplified by
      // adding these values directly on the remote signer interface
      // for the sake of simplicity, we'll just decode it here

      const decodedAux = ethers.utils.defaultAbiCoder.decode(['address', 'uint256', 'bytes'], entry.auxData)
      const address = decodedAux[0]
      const message = decodedAux[2]

      const key = `${address}${message}`
      if (!batches[key]) {
        batches[key] = [entry]
      } else {
        batches[key].push(entry)
      }
    }

    // Process every batch at the same time
    await Promise.all(Object.values(batches).map(async (batch) => {
      try {
        // Convert into SignRequest
        const requests = batch.map((entry) => ({
          msg: entry.message,
          auxData: entry.auxData,
          chainId: entry.chainId.toNumber()
        }))

        const responses = await this._guardd.batchSign({ requests })
        batch.forEach((item, i) => {
          item.resolve(responses.sig[i])
        })
      } catch (e) {
        batch.forEach((item) => {
          item.reject(e)
        })
      }
    }))
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
      this.scheduleExecution()
    })
  }

  async getAddress(): Promise<string> {
    return this._address
  }
}

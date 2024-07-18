import { ethers } from 'ethers'
import { runByEIP5719, URISolver } from '.'

export class CachedEIP5719 {
  constructor(
    public provider: ethers.Provider,
    public solver?: URISolver,
    public window: number = 1000
  ) {}

  private pending: Map<
    string,
    {
      timestamp: number
      promise: Promise<ethers.BytesLike>
    }
  > = new Map()

  async runByEIP5719(address: string, digest: ethers.BytesLike, signature: ethers.BytesLike): Promise<ethers.BytesLike> {
    const key = `${address}-${digest}-${signature}`
    const now = Date.now()

    if (this.pending.has(key) && now - this.pending.get(key)!.timestamp < this.window) {
      return this.pending.get(key)!.promise
    }

    const promise = runByEIP5719(address, this.provider, digest, signature, this.solver)
    this.pending.set(key, { timestamp: now, promise })
    return promise
  }
}

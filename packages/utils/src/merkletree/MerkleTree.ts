import { Buffer } from 'buffer'
import { ethers } from 'ethers'
import { Base } from './Base'

type TValue = Buffer | BigInt | string | number
type TLeaf = Buffer
type TLayer = TLeaf[]
type THashFn = (value: TValue) => TLeaf

export interface Options {
  sortLeaves?: boolean
  sortPairs?: boolean
}

export type Proof = { position: 'left' | 'right'; data: Buffer }[]

export class MerkleTree extends Base {
  private hashFn: THashFn
  private leaves: TLeaf[] = []
  private layers: TLayer[] = []
  private sortLeaves: boolean = false
  private sortPairs: boolean = false

  constructor(leaves: any[], options: Options = {}) {
    super()

    this.sortLeaves = !!options.sortLeaves
    this.sortPairs = !!options.sortPairs

    this.hashFn = this.bufferifyFn(ethers.utils.keccak256)
    this.processLeaves(leaves)
  }

  public getOptions() {
    return {
      sortLeaves: this.sortLeaves,
      sortPairs: this.sortPairs
    }
  }

  private processLeaves(leaves: TLeaf[]) {
    this.leaves = leaves.map(this.bufferify)
    if (this.sortLeaves) {
      this.leaves = this.leaves.sort(Buffer.compare)
    }

    this.createHashes(this.leaves)
  }

  private createHashes(nodes: Buffer[]) {
    this.layers = [nodes]
    while (nodes.length > 1) {
      const layerIndex = this.layers.length

      this.layers.push([])

      const layerLimit = nodes.length

      for (let i = 0; i < nodes.length; i += 2) {
        if (i >= layerLimit) {
          this.layers[layerIndex].push(...nodes.slice(layerLimit))
          break
        } else if (i + 1 === nodes.length) {
          if (nodes.length % 2 === 1) {
            // push copy of hash and continue iteration
            this.layers[layerIndex].push(nodes[i])
            continue
          }
        }

        const left = nodes[i]
        const right = i + 1 === nodes.length ? left : nodes[i + 1]
        const combined = [left, right]

        if (this.sortPairs) {
          combined.sort(Buffer.compare)
        }

        const hash = this.hashFn(Buffer.concat(combined))
        this.layers[layerIndex].push(hash)
      }

      nodes = this.layers[layerIndex]
    }
  }

  getRoot(): Buffer {
    if (this.layers.length === 0) {
      return Buffer.from([])
    }

    return this.layers[this.layers.length - 1][0] || Buffer.from([])
  }

  getHexRoot(): string {
    return this.bufferToHex(this.getRoot())
  }

  getProof(leaf: Buffer | string, index?: number): Proof {
    if (typeof leaf === 'undefined') {
      throw new Error('leaf is required')
    }
    leaf = this.bufferify(leaf)
    const proof: Proof = []

    if (!Number.isInteger(index)) {
      index = -1

      for (let i = 0; i < this.leaves.length; i++) {
        if (Buffer.compare(leaf, this.leaves[i]) === 0) {
          index = i
        }
      }
    }

    // Type fix
    index = index as number

    if (index <= -1) {
      return []
    }

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i]
      const isRightNode = index % 2
      const pairIndex = isRightNode ? index - 1 : index + 1

      if (pairIndex < layer.length) {
        proof.push({
          position: isRightNode ? 'left' : 'right',
          data: layer[pairIndex]
        })
      }

      // set index to parent index
      index = (index / 2) | 0
    }

    return proof
  }

  getHexProof(leaf: Buffer | string, index?: number): string[] {
    return this.getProof(leaf, index).map(item => this.bufferToHex(item.data))
  }

  verify(proof: any[], targetNode: Buffer | string, root: Buffer | string): boolean {
    let hash = this.bufferify(targetNode)
    root = this.bufferify(root)

    if (!Array.isArray(proof) || !targetNode || !root) {
      return false
    }

    for (let i = 0; i < proof.length; i++) {
      const node = proof[i]
      let data: Buffer
      let isLeftNode: boolean

      // case for when proof is hex values only
      if (typeof node === 'string') {
        data = this.bufferify(node)
        isLeftNode = true
      } else if (Array.isArray(node)) {
        isLeftNode = node[0] === 0
        data = this.bufferify(node[1])
      } else if (Buffer.isBuffer(node)) {
        data = node
        isLeftNode = true
      } else if (node instanceof Object) {
        data = this.bufferify(node.data)
        isLeftNode = node.position === 'left'
      } else {
        throw new Error('Expected node to be of type string or object')
      }

      const buffers: Buffer[] = []

      if (this.sortPairs) {
        if (Buffer.compare(hash, data) === -1) {
          buffers.push(hash, data)
        } else {
          buffers.push(data, hash)
        }
        hash = this.hashFn(Buffer.concat(buffers))
      } else {
        buffers.push(hash)
        buffers[isLeftNode ? 'unshift' : 'push'](data)
        hash = this.hashFn(Buffer.concat(buffers))
      }
    }

    return Buffer.compare(hash, root) === 0
  }
}

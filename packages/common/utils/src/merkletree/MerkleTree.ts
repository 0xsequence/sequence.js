import { ethers } from 'ethers'
import { Base } from './Base'

type TValue = string
type TLeaf = Uint8Array
type TLayer = TLeaf[]
type THashFn = (value: TValue | TLeaf) => TLeaf

export interface Options {
  sortLeaves?: boolean
  sortPairs?: boolean
}

export type Proof = { position: 'left' | 'right'; data: Uint8Array }[]

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

    this.hashFn = Base.bufferifyFn(ethers.keccak256)
    this.processLeaves(leaves)
  }

  public getOptions() {
    return {
      sortLeaves: this.sortLeaves,
      sortPairs: this.sortPairs
    }
  }

  private processLeaves(leaves: TLeaf[]) {
    this.leaves = leaves.map(Base.bufferify)
    if (this.sortLeaves) {
      this.leaves = this.leaves.sort(Base.compare)
    }

    this.createHashes(this.leaves)
  }

  private createHashes(nodes: Uint8Array[]) {
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
          combined.sort(Base.compare)
        }

        const hash = this.hashFn(ethers.concat(combined))
        this.layers[layerIndex].push(hash)
      }

      nodes = this.layers[layerIndex]
    }
  }

  getRoot(): Uint8Array {
    if (this.layers.length === 0) {
      return Uint8Array.from([])
    }

    return this.layers[this.layers.length - 1][0] || Uint8Array.from([])
  }

  getHexRoot(): string {
    return Base.bufferToHex(this.getRoot())
  }

  getProof(leaf: Uint8Array | string, index?: number): Proof {
    if (typeof leaf === 'undefined') {
      throw new Error('leaf is required')
    }
    leaf = Base.bufferify(leaf)
    const proof: Proof = []

    if (!Number.isInteger(index)) {
      index = -1

      for (let i = 0; i < this.leaves.length; i++) {
        if (Base.compare(leaf, this.leaves[i]) === 0) {
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

  getHexProof(leaf: Uint8Array | string, index?: number): string[] {
    return this.getProof(leaf, index).map(item => Base.bufferToHex(item.data))
  }

  verify(proof: Proof | string[], targetNode: Uint8Array | string, root: Uint8Array | string): boolean {
    let hash = Base.bufferify(targetNode)
    root = Base.bufferify(root)

    if (!Array.isArray(proof) || !targetNode || !root) {
      return false
    }

    for (let i = 0; i < proof.length; i++) {
      const node = proof[i]
      let data: Uint8Array
      let isLeftNode: boolean

      if (typeof node === 'string') {
        data = Base.bufferify(node)
        isLeftNode = true
      } else if (node instanceof Object) {
        data = node.data
        isLeftNode = node.position === 'left'
      } else {
        throw new Error('Expected node to be of type string or object')
      }

      const buffers: Uint8Array[] = []

      if (this.sortPairs) {
        if (Base.compare(hash, data) < 0) {
          buffers.push(hash, data)
        } else {
          buffers.push(data, hash)
        }
        hash = this.hashFn(ethers.concat(buffers))
      } else {
        buffers.push(hash)
        buffers[isLeftNode ? 'unshift' : 'push'](data)
        hash = this.hashFn(ethers.concat(buffers))
      }
    }

    return Base.compare(hash, root) === 0
  }
}

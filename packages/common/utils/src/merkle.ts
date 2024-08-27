import { ethers } from 'ethers'
import { MerkleTree } from './merkletree'

export type ToLeaf<T> = (element: T) => string
export type Proof = string[]

export class MerkleTreeGenerator<T> {
  private elements: T[]
  private toLeaf: ToLeaf<T>
  private tree: MerkleTree

  constructor(elements: T[], toLeaf: ToLeaf<T>) {
    this.elements = elements
    this.toLeaf = toLeaf
  }

  generateTree(): MerkleTree {
    const hashed = this.elements.map(e => this.toLeaf(e))
    return new MerkleTree(hashed, {
      sortPairs: true,
      sortLeaves: true
    })
  }

  generateRoot(): string {
    if (!this.tree) this.tree = this.generateTree()
    return this.tree.getHexRoot()
  }

  generateProof(element: T): Proof {
    if (!this.elements.includes(element)) throw new Error('Element not found')
    if (!this.tree) this.tree = this.generateTree()
    return this.tree.getHexProof(this.toLeaf(element))
  }

  verifyProof(element: T, proof: Proof): boolean {
    if (!this.elements.includes(element)) throw new Error('Element not found')
    if (!this.tree) this.tree = this.generateTree()
    return this.tree.verify(proof, this.toLeaf(element), this.generateRoot())
  }
}

export type SaleItemsElement = {
  address: string
  tokenId: ethers.BigNumberish
}

export const getSaleItemsLeaf: ToLeaf<SaleItemsElement> = element =>
  ethers.solidityPackedKeccak256(['address', 'uint256'], [element.address.toLowerCase(), element.tokenId])

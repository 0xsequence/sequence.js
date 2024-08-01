import { expect } from 'chai'
import { MerkleTreeGenerator, SaleItemsElement, getSaleItemsLeaf } from '@0xsequence/utils'
import { BigNumber, Wallet, constants, utils } from 'ethers'

describe('merkle', function () {
  const addrs = Array.from({ length: 10 }, () => Wallet.createRandom().address)
  const elements: SaleItemsElement[] = addrs.map(addr => ({ address: addr, tokenId: BigNumber.from(1) }))

  it('generates tree, root and proof for custom elements', () => {
    const getLeaf = (element: string) => utils.solidityKeccak256(['address'], [element.toLowerCase()])
    const merkleGenerator = new MerkleTreeGenerator(addrs, getLeaf)
    expect(merkleGenerator.generateRoot()).to.be.a('string')
    const proof = merkleGenerator.generateProof(addrs[0])
    expect(proof).to.be.an('array')
    expect(merkleGenerator.verifyProof(addrs[0], proof)).to.be.true
  })

  it('generates tree, root and proof for sale items', () => {
    const merkleGenerator = new MerkleTreeGenerator(elements, getSaleItemsLeaf)
    expect(merkleGenerator.generateRoot()).to.be.a('string')
    const proof = merkleGenerator.generateProof(elements[0])
    expect(proof).to.be.an('array')
    expect(merkleGenerator.verifyProof(elements[0], proof)).to.be.true
  })

  it('errors when invalid element', () => {
    const merkleGenerator = new MerkleTreeGenerator(elements, getSaleItemsLeaf)
    const invalidElement: SaleItemsElement = {
      address: Wallet.createRandom().address,
      tokenId: constants.Zero
    }
    expect(() => merkleGenerator.generateProof(invalidElement)).to.throw('Element not found')
  })
})

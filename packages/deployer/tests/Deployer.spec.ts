import { expect } from 'chai'
import { UNIVERSAL_DEPLOYER_2_BYTECODE } from '../src/constants'

import { Deployer } from '../src/Deployer'
import { Wallet } from 'ethers'
import { UniversalDeployer2__factory } from '../src/typings/contracts'

describe('Deployer', function () {
  let wallet: Wallet
  let deployer: Deployer

  before(async () => {
    wallet = Wallet.createRandom()
    deployer = new Deployer('hardhat', wallet, wallet)
  })

  it('validates bytecode', () => {
    deployer.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() => deployer.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE + 'ABC')).to.throw('Bytecode mismatch')
  })
})

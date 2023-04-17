import { expect } from 'chai'
import { config as dotenvConfig } from 'dotenv'
import { UNIVERSAL_DEPLOYER_2_BYTECODE } from '../../src/constants'

import { Wallet } from 'ethers'
import { ContractVerifier } from '../../src/ContractVerifier'
import { UniversalDeployer2__factory } from '../../src/typings/contracts'

dotenvConfig()

describe('ContractVerifier', () => {
  let verifier: ContractVerifier
  let wallet: Wallet

  before(async () => {
    wallet = Wallet.createRandom()

    verifier = new ContractVerifier({
      accessKey: "ABC",
      accountName: "DEF",
      projectName: "GHI",
      network: 11155111,
    }, "JKL", wallet)
  })

  it('validates bytecode', () => {
    verifier.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() => verifier.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE + 'ABC')).to.throw('Bytecode mismatch')
  })

})

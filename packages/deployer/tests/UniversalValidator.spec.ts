import { Network, Tenderly } from '@tenderly/sdk'
import { expect } from 'chai'
import * as sinon from 'sinon'
import { config as dotenvConfig } from 'dotenv'
import { UNIVERSAL_DEPLOYER_2_ADDRESS, UNIVERSAL_DEPLOYER_2_BYTECODE } from '../src/constants'

import { UniversalValidator } from '../src/UniversalValidator'
import { Wallet } from 'ethers'
import { UniversalDeployer2__factory } from '../src/typings/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { COUNTER_ADDR_SEPOLIA, COUNTER_SOURCE } from './utils/constants'

dotenvConfig()

describe('UniversalValidator', () => {
  let wallet: Wallet
  let deployer: UniversalValidator

  before(async () => {
    wallet = Wallet.createRandom()
    deployer = new UniversalValidator('hardhat', wallet.provider as JsonRpcProvider, wallet)
  })

  it('validates bytecode', () => {
    deployer.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() => deployer.validateBytecode(UniversalDeployer2__factory, UNIVERSAL_DEPLOYER_2_BYTECODE + 'ABC')).to.throw('Bytecode mismatch')
  })

  describe('Tenderly Verification', () => {
    let tenderly: Tenderly
    let addStub: sinon.SinonStub
    let verifyStub: sinon.SinonStub

    before(async () => {
      if (process.env.TENDERLY_ACCESS_KEY === undefined) {
        console.log('Tenderly API key not found, using stubs')
        // Stub tenderly
        tenderly = new Tenderly({
          accessKey: "ABC",
          accountName: "DEF",
          projectName: "GHI",
          network: Network.SEPOLIA,
        })
        addStub = sinon.stub(tenderly.contracts, "add")
        verifyStub = sinon.stub(tenderly.contracts, "verify")
      } else {
        // Do it for real. Requires manual review on Tenderly
        console.log('Tenderly API key found, using real API for tests')
        tenderly = new Tenderly({
          accessKey: process.env.TENDERLY_ACCESS_KEY,
          accountName: process.env.TENDERLY_ACCOUNT_NAME!,
          projectName: process.env.TENDERLY_PROJECT_NAME!,
          network: Network.SEPOLIA,
        })
      }
    })

    after(async () => {
      sinon.restore()
    })

    it('verifies Tenderly source', async () => {
      await deployer.verifyContractTenderly(COUNTER_ADDR_SEPOLIA, "contractAlias", tenderly, {
        config: {
          mode: 'public',
        },
        contractToVerify: 'Counter.sol:CounterWithLogs',
        solc: {
          version: 'v0.8.18',
          sources: {
            'Counter.sol': {
              content: COUNTER_SOURCE,
            },
          },
          settings: {
            libraries: {},
            optimizer: {
              enabled: false,
            },
          },
        },
      })

      // Check
      if (addStub) {
        expect(addStub.calledOnce).to.be.true
      }
      if (verifyStub) {
        expect(verifyStub.calledOnce).to.be.true
      }
    })
  })

})

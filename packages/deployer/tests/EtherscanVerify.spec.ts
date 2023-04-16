import { expect } from 'chai'
import * as sinon from 'sinon'
import { config as dotenvConfig } from 'dotenv'
import { UNIVERSAL_DEPLOYER_2_ADDRESS } from '../src/constants'

import axios from 'axios'

import { EtherscanVerificationRequest, EtherscanVerify } from '../src/etherscan/EtherscanVerify'
import path from 'path'
import { readFile } from 'fs/promises'
import { JsonRpcProvider } from '@ethersproject/providers'
import { UniversalDeployer2__factory } from '../src/typings/contracts'
import { Wallet } from 'ethers'

dotenvConfig()

describe('EtherscanVerify', () => {
  let etherscanVerify: EtherscanVerify
  let axiosPostStub: sinon.SinonStub
  let axiosGetStub: sinon.SinonStub
  let contractAddr = UNIVERSAL_DEPLOYER_2_ADDRESS

  before(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } = process.env
    if (SEPOLIA_PRIVATE_KEY === undefined || SEPOLIA_RPC_URL === undefined || ETHERSCAN_API_KEY === undefined) {
      // Stub fetch
      console.log('Required Sepolia env vars not found, using stubs')
      axiosPostStub = sinon
        .stub(axios, 'post')
        .resolves({ data: { status: '1', result: 'Verified' } })
      axiosPostStub = sinon
        .stub(axios, 'get')
        .resolves({ data: { status: '1', result: 'Passed verification' } })
    } else {
      // Do it for real. Requires manual review on Etherscan
      console.log('Sepolia env vars found, using real API for tests')
    }

    etherscanVerify = new EtherscanVerify(ETHERSCAN_API_KEY ?? 'ABC', 'sepolia')
  })

  after(async () => {
    sinon.restore()
  })

  it('verifies etherscan source', async () => {
    const request: EtherscanVerificationRequest = {
      contractToVerify: 'contracts/UniversalDeployer2.sol:UniversalDeployer2',
      version: 'v0.7.6+commit.7338295f',
      compilerInput: {
        language: "Solidity",
        sources: {
          'contracts/UniversalDeployer2.sol': {
            content: await readFile(path.join('contracts', 'UniversalDeployer2.sol'), 'utf8'),
          },
        },
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
            details: {
              yul: true,
            },
          },
          outputSelection: {
            "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "evm.methodIdentifiers", "metadata"], "": ["ast"] }
          },
          libraries: {},
          remappings: [],
        },
      },
      waitForSuccess: true,
    }

    // Check
    // solc.loadRemoteVersion(request.version, (err, solcSnapshot) => {
    //   if (err) {
    //     console.log(err)
    //   }
    //   const output = JSON.parse(solcSnapshot.compile(JSON.stringify(request.compilerInput)))
    //   expect(output.contracts['contracts/UniversalDeployer2.sol']['UniversalDeployer2'].evm.bytecode.object).to.equal(UniversalDeployer2__factory.bytecode.slice(2))
    // })

    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } = process.env
    if (SEPOLIA_PRIVATE_KEY !== undefined && SEPOLIA_RPC_URL !== undefined && ETHERSCAN_API_KEY !== undefined) {
      // Deploy something new so we can verify it
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
      const factory = new UniversalDeployer2__factory(wallet)
      const deployed = await factory.deploy()
      contractAddr = deployed.address
      console.log(contractAddr)

      // Pause for Etherscan to index contract
      console.log("Waiting a bit so Etherscan can index contract")
      await new Promise(resolve => setTimeout(resolve, 20000)) // Delay 20s (sometimes it needs longer...)
    }

    await etherscanVerify.verify(contractAddr, request)

    if (axiosPostStub) {
      expect(axiosPostStub.calledOnce).to.be.true
    }
    if (axiosGetStub) {
      // With real API this could be called multiple times
      expect(axiosGetStub.calledOnce).to.be.true
    }
  }).timeout(30000)
})

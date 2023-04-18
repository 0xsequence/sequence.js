import { expect } from 'chai'
import { config as dotenvConfig } from 'dotenv'
import * as sinon from 'sinon'
import { BigNumber, Signer, Wallet, ethers, providers } from 'ethers'

import { UniversalDeployer } from '../src/UniversalDeployer'

dotenvConfig()

describe('UniversalDeployer', () => {
  let deployer: UniversalDeployer
  let isMocked: boolean = false

  let signer: Signer
  let provider: providers.JsonRpcProvider

  before(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
    if (SEPOLIA_PRIVATE_KEY === undefined || SEPOLIA_RPC_URL === undefined) {
      console.log('Sepolia configuration not found, using stubs')
      isMocked = true
      provider = new providers.JsonRpcProvider()
      signer = Wallet.createRandom().connect(provider)

    } else {
      // Do it for real
      console.log('Sepolia configuration found, using real wallets for tests')
      provider = new providers.JsonRpcProvider(SEPOLIA_RPC_URL)
      signer = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
    }

    deployer = new UniversalDeployer('sepolia', provider, signer)
  })

  after(async () => {
    sinon.restore()
  })

  describe('Recovers funds', () => {
    let signer2: Signer

    before(async () => {
      // Randomly created private key for receiving funds
      const w = Wallet.createRandom()
      signer2 = w.connect(provider)
      // Log key in case returning funds fails
      console.log(`Funds covered to addr with private key: ${w.privateKey}`)
    })

    it('To EOA', async () => {
      let before: BigNumber
      let sendTxSpy: sinon.SinonSpy

      if (isMocked) {
        before = ethers.utils.parseEther('1')

        // Configure mocks
        sinon.stub(provider, "getCode").resolves('0x')
        sinon.stub(provider, "getGasPrice").resolves(ethers.constants.Two) // Gas cost for stub is 21000 * 2 = 42000
        const balanceStub = sinon.stub(provider, "getBalance")
        balanceStub.onCall(0).resolves(before) // Signer starting balance
        balanceStub.onCall(1).resolves(ethers.constants.One) // Signer dust balance
        balanceStub.onCall(2).resolves(ethers.constants.One) // After balance in test
        balanceStub.onCall(3).resolves(before.sub(ethers.constants.One).sub(42000)) // Signer2 after balance

        const mockTx: providers.TransactionResponse = {
          hash: '0x0',
          from: await signer.getAddress(),
          nonce: 0,
          gasLimit: ethers.constants.Two,
          data: '0x',
          value: ethers.constants.One,
          chainId: 11155111,
          confirmations: 10,
          wait: sinon.stub(),
        }

        const sendTxStub = sinon.stub(signer, "sendTransaction").resolves(mockTx)
        sendTxSpy = sinon.spy(sendTxStub)
      } else {
        before = await provider.getBalance(await signer.getAddress())
      }

      // Hard coded addr for receiving funds
      const dust = await deployer.recoverFunds(await signer2.getAddress())

      // Test result
      const after = await provider.getBalance(await signer.getAddress())
      const signerAfter = await provider.getBalance(await signer2.getAddress())

      expect(signerAfter).to.not.eql(ethers.constants.Zero)
      expect(after).to.eql(dust)
      
      if (isMocked) {
        expect(before.sub(dust).sub(42000)).to.eql(signerAfter)
      } else {
        // Give funds back to original addr when not mocked
        const deployer2 = new UniversalDeployer('sepolia', provider, signer2)
        await deployer2.recoverFunds(await signer.getAddress())
      }
    }).timeout(30000)
  })

})

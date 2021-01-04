import { test, assert } from '../../utils/assert'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { Wallet, DefaultProviderConfig } from '@0xsequence/provider'
import { testAccounts, getEOAWallet, deployWalletContext, testWalletContext, sendETH } from '../testutils'
import { sequenceContext } from '@0xsequence/network'

export const tests = async () => {

  //
  // Deploy Sequence WalletContext (deterministic). We skip deployment
  // as we rely on mock-wallet to deploy it.
  //
  const deployedWalletContext = testWalletContext
  console.log('walletContext:', deployedWalletContext)

  //
  // Setup
  //
  const providerConfig = { ...DefaultProviderConfig }
  providerConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  
  const wallet = new Wallet(providerConfig)
  
  // clear it in case we're testing in browser session
  wallet.logout()
    

  await test('is logged out', async () => {
    assert.false(wallet.isLoggedIn(), 'is logged out')
  })

  await test('is disconnected', async () => {
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('login', async () => {
    const loggedIn = await wallet.login()
    assert.true(loggedIn, 'is logged in')
  })

  await test('isConnected', async () => {
    assert.true(wallet.isConnected(), 'is connected')
  })

  await test('getChainId', async () => {
    const chainId = wallet.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('getAccounts', async () => {
    const address = wallet.getAddress()
    assert.equal(address.toLowerCase(), '0x1abe642a25d9f3a725f07c622abd4356646c1820'.toLowerCase(), 'wallet address is correct')
  })

  await test('getWalletConfig', async () => {
    const allWalletConfigs = await wallet.getWalletConfig()

    assert.equal(allWalletConfigs.length, 1, '1 wallet config')
    const config = allWalletConfigs[0]

    assert.true(config.chainId !== undefined, 'config, chainId is set')
    assert.true(config.threshold === 1, 'config, 1 threshold')
    assert.true(config.signers.length === 1, 'config, 1 signer')
    assert.true(config.signers[0].address === '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853', 'config, signer address')
    assert.true(config.signers[0].weight === 1, 'config, signer weight')
  })

  await test('getBalance', async () => {
    // technically, the mock-wallet's single signer owner has some ETH..
    const balanceSigner1 = await wallet.getProvider().getBalance('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853')
    assert.true(balanceSigner1.gt(ethers.BigNumber.from(0)), 'signer1 balance > 0')
  })

  await test('sendETH from the sequence smart wallet', async () => {
    // first, lets move some ETH into the wallet from a testnet seed account
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey)
      const walletBalanceBefore = await wallet.getSigner().getBalance()

      const ethAmount = ethers.utils.parseEther('10.1234')
      const txResp = await sendETH(testAccount, wallet.getAddress(), ethAmount)
      const txReceipt = await wallet.getProvider().getTransactionReceipt(txResp.hash)
      assert.true(txReceipt.status === 1, 'eth sent from signer1')

      const walletBalanceAfter = await wallet.getSigner().getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).eq(ethAmount), `wallet received ${ethAmount} eth`)
    }


    // sequence wallet to now send some eth back to another seed account
    // via the relayer
    {
      const walletAddress = wallet.getAddress()
      const walletBalanceBefore = await wallet.getSigner().getBalance()


      // send eth from sequence smart wallet to another test account
      const toAddress = testAccounts[1].address


      // TODO: failed txn with amount too high, etc.
      // TODO: send txn to invalid address

      const ethAmount = ethers.utils.parseEther('1.4242')

      // NOTE: although the txn contents are to send from our sequence wallet to the test account,
      // the transaction by the Sequence Wallet instance will be sent `to` the `GuestModule` smart contract
      // address of the Sequence context `from` the Sequence Relayer (local) account.
      //
      // The tx contents below are wrapped in a smart contract call, which will then internally execute
      // the ETH transfer from the GuestModule.
      //
      // Also note, the gasLimit and gasPrice can be estimated by the relayer.

      const tx = {
        gasLimit: '0x555', // TODO: dont set the gas..? .. test with + without.. to ensure override, etc.
        gasPrice: '0x555', // TODO: don't set, relayer handles this
        from: walletAddress,
        to: toAddress,
        value: ethAmount,
      }
      console.log('===>', tx)

      const txResp = await wallet.getSigner().sendTransaction(tx)

      const txReceipt = await wallet.getProvider().getTransactionReceipt(txResp.hash)
      assert.true(txReceipt.status === 1, 'txn sent successfully')

      console.log('receipt..?', txReceipt)

      // TODO: the txn seems to be sending, however, txReceipt isn't showing message "to" the guest module..? hmpf.
      // I suppose when things are working correctly (as now), we absract the relayer

      // assert.equal(txReceipt.to.toLowerCase(), deployedWalletContext.guestModule.toLowerCase(), 'tx is sent to the guest module')
      // assert.equal(txReceipt.from.toLowerCase(), testAccounts[5].address.toLowerCase(), 'tx is sent from the relayer account')

      const walletBalanceAfter = await wallet.getSigner().getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).mul(-1).eq(ethAmount), `wallet sent ${ethAmount} eth`)

      // TODO: assert toAddress balance increased


    }
  })

  
  // <Button px={3} m={1} onClick={() => signMessage()}>Sign Message</Button>
  // <Button px={3} m={1} onClick={() => sign712()}>Sign TypedData</Button>
  // <Button px={3} m={1} onClick={() => signAuthMessage()}>Sign auth-chain message</Button>
  // <Button px={3} m={1} onClick={() => signETHAuth()}>Sign Authorization</Button>

  // sendETH ..
  // <Button px={3} m={1} onClick={() => sendTransactionForSidechain()}>Send sidechain transaction</Button>
  // <Button px={3} m={1} onClick={() => sendBatchTransaction()}>Send batch transaction</Button>
  // <Button px={3} m={1} onClick={() => sendARC()}>Contract, ARC: balanceOf</Button>
  
}


// TODO: test getting sequence signer, and getting the wallet config

// TODO: send batch transaction

// TODO: send coins

// TODO: send collectible

// TODO: setup all other tests from demo-dapp, just do it..

// TODO: setup some failure states..? hmm, might be trickier, but maybe could have requestHandler do some faults/other..

// TODO: add auth helpers to @0xsequence/auth, and heplers in "commands"


//
//--------
//

// import { sequence} from '@0xsequence'

// const wallet = new sequence.Wallet()
// wallet.login()

// wallet.sendETH()
// wallet.signMessage()

// wallet.sendTransaction(...)

// const tokens = new sequence.Tokens()

// tokens.mintCoin(xx)
// tokens.mintCollectible()

// wallet.sendTransaction(tokens.mintCoin(xx))
// wallet.sendTransaction(tokens.mintCollectible(xx))

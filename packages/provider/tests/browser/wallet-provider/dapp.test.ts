import { test, assert } from '../../utils/assert'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { Wallet, DefaultWalletProviderConfig } from '@0xsequence/provider'
import { testAccounts, getEOAWallet, sendETH } from '../testutils'

export const tests = async () => {

  const walletConfig = { ...DefaultWalletProviderConfig }
  walletConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  
  const wallet = new Wallet(walletConfig)
  
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
    assert.equal(address.toLowerCase(), '0x24E78922FE5eCD765101276A422B8431d7151259'.toLowerCase(), 'wallet address is correct')
  })

  await test('getBalance', async () => {
    // technically, the mock-wallet's single signer owner has some ETH..
    const balanceSigner1 = await wallet.getProvider().getBalance('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853')
    assert.true(balanceSigner1.gt(ethers.BigNumber.from(0)), 'signer1 balance > 0')
  })

  await test('sendETH from the sequence smart wallet', async () => {
    // first, lets move some ETH into the wallet from a testnet seed account
    const testAccount = getEOAWallet(testAccounts[0].privateKey)
    const txResp1 = await sendETH(testAccount, wallet.getAddress(), '10.1234')
    const txReceipt1 = await wallet.getProvider().getTransactionReceipt(txResp1.hash)
    assert.true(txReceipt1.status === 1, 'eth sent from signer1')
    const walletBalance = await wallet.getSigner().getBalance()
    assert.true(walletBalance.gt(ethers.BigNumber.from(0)), 'wallet balance > 0')

    // sequence wallet to now send some eth back to another seed account
    // via the relayer

  })
  
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

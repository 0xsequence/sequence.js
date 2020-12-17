import { test, assert } from '../../utils/assert'
import { Wallet, DefaultWalletProviderConfig } from '@0xsequence/provider'

export const tests = async () => {

  const walletConfig = { ...DefaultWalletProviderConfig }
  walletConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  
  const wallet = new Wallet(walletConfig)
  
  // clear it in case we're testing in browser session
  wallet.logout()
    

  await test('starting logged out', async () => {
    assert.false(wallet.isLoggedIn(), 'starting logged out')
  })

  await test('login', async () => {
    const loggedIn = await wallet.login()
    assert.true(loggedIn, 'wallet login')
  })

}



// TODO: test login here

// TODO: signAuthMessage request

// TODO: sign EIP 712

// TODO: send ETH Transaction ..
// TODO: first lets get some balance..

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

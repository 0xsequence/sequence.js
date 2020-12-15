import { test, assert } from '../../utils/assert'
import { Wallet, DefaultWalletProviderConfig } from '@0xsequence/provider'

export const tests = async () => {

  const walletConfig = { ...DefaultWalletProviderConfig }
  walletConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'

  const wallet = new Wallet(walletConfig)

  // TODO: first lets assert we're not logged in, its closed, etc..

  await test('login', async () => {
    const loggedIn = await wallet.login()
    assert.true(loggedIn, 'wallet login')
  })

  test('hi', () => {
    assert.true(true)
  })
}

// TODO: go to town on testing everything..

// TODO: test the auth, login, etc.......

// TODO: add auth helpers to @0xsequence/auth, and heplers in "commands"

//--------

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

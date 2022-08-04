import { test, assert } from '../../utils/assert'
import { Wallet, DefaultProviderConfig, BrowserRedirectMessageHooks } from '@0xsequence/provider'
import { configureLogger } from '@0xsequence/utils'
import { testWalletContext,  } from '../testutils'

configureLogger({ logLevel: 'DEBUG', silence: false })

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
  providerConfig.transports = {
    windowTransport: {
      enabled: false
    },
    urlTransport: {
      enabled: true,
      redirectUrl: 'http://localhost:9999/url-transport/dapp.test.html',
      hooks: new BrowserRedirectMessageHooks()
    }
  }

  const wallet = new Wallet('hardhat', providerConfig)

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  const provider = wallet.getProvider()
  const signer = wallet.getSigner()

  console.log('hiii?')

  // clear it in case we're testing in browser session
  wallet.disconnect()

  console.log('hiii?2')

  await test('is logged out', async () => {
    console.log('a')
    assert.false(wallet.isConnected(), 'is logged out')
  })

  await test('is disconnected', async () => {
    console.log('b')
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('connect / login', async () => {
    console.log('c')

    const { connected } = await wallet.connect({
      keepWalletOpened: true
    })

    console.log('sup???')

    assert.true(connected, 'is connected')
  })

  await test('isConnected', async () => {
    console.log('d')

    assert.true(wallet.isConnected(), 'is connected')
  })

}

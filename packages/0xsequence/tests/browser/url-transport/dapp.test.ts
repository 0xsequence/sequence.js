import { test, assert } from '../../utils/assert'
import { Wallet, DefaultProviderConfig, BrowserRedirectMessageHooks, ProviderMessage } from '@0xsequence/provider'
import { configureLogger } from '@0xsequence/utils'
import { testWalletContext } from '../testutils'
import { ethers } from 'ethers'
import { base64DecodeObject } from '../../../../utils/src/base64'
import { ConnectDetails } from '../../../../provider/src/types'

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

  const windowURL = new URL(window.location.href)
  const response = windowURL.searchParams.get('response')
  if (response) {
    const decoded = base64DecodeObject(response) as ProviderMessage<any>
    console.log('... we have a response...', decoded)
    wallet.finalizeConnect(decoded.data as ConnectDetails)

    await test('isConnected', async () => {
      console.log('d isConnected', wallet.isConnected())

      assert.true(wallet.isConnected(), 'is connected')
    })

    await test('getAddress', async () => {
      console.log('getAddress start')
      console.log('wallet.getAddress', await wallet.getAddress())
      const address = await signer.getAddress()
      console.log('signer.getAddress', address)
      assert.equal(address, ethers.utils.getAddress('0xa91Ab3C5390A408DDB4a322510A4290363efcEE9'), 'wallet address')
    })

    // await test('getWalletConfig', async () => {
    //   console.log('start f')
    //   const allWalletConfigs = await wallet.getWalletConfig()
    //   console.log('allWalletConfigs')
    // })
    return
  }

  // clear it in case we're testing in browser session
  wallet.disconnect()

  await test('is logged out', async () => {
    // console.log('a')
    assert.false(wallet.isConnected(), 'is logged out')
  })

  await test('is disconnected', async () => {
    // console.log('b')
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('connect / login', async () => {
    // console.log('c')

    const { connected } = await wallet.connect({
      keepWalletOpened: true
    })

    console.log('sup???')

    assert.true(connected, 'is connected')
  })

  // await test('sending a json-rpc request', async () => {
  //   await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
  //     assert.true(!err, 'error is empty')
  //     assert.true(!!resp, 'response successful')
  //     assert.true(resp.result[0] === address, 'response address check')
  //   })

  //   const resp = await provider.send('eth_accounts', [])
  //   assert.true(!!resp, 'response successful')
  //   assert.true(resp[0] === address, 'response address check')
  // })
}

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

  const session = localStorage.getItem('@sequence.session')

  // If we have a session, test getting config
  if (session) {
    const sessionObj = JSON.parse(session)
    const connectDetails: ConnectDetails = {
      connected: true,
      chainId: sessionObj.providerCache.eth_chainId,
      session: sessionObj
    }
    wallet.finalizeConnect(connectDetails)

    await test('getWalletConfig', async () => {
      console.log('... getWalletConfig test')
      const allWalletConfigs = await wallet.getWalletConfig()
      console.log('allWalletConfigs', allWalletConfigs)
    })

    return
  }

  const windowURL = new URL(window.location.href)
  const response = windowURL.searchParams.get('response')

  if (response) {
    const decoded = base64DecodeObject(response) as ProviderMessage<any>
    console.log('... we have a response...', decoded)
    console.log('... data', JSON.stringify(decoded.data, null, 2))

    if (decoded.type === 'connect') {
      wallet.finalizeConnect(decoded.data as ConnectDetails)

      await test('isConnected', async () => {
        console.log('d isConnected', wallet.isConnected())

        assert.true(wallet.isConnected(), 'is connected')
      })
    }

    return
  }

  await test('connect / login', async () => {
    const { connected } = await wallet.connect({
      keepWalletOpened: true
    })

    console.log('sup???')

    assert.true(connected, 'is connected')
  })
}

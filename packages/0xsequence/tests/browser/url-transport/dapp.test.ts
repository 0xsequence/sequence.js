// NOTE: run `pnpm test:server` and open browser at http://localhost:9999/url-transport/dapp.test.html
// to run tests from this file directly from your Web Browser.

import { test, assert } from '../../utils/assert'
import { Wallet, DefaultProviderConfig, BrowserRedirectMessageHooks, ProviderMessage, ConnectDetails } from '@0xsequence/provider'
import { configureLogger, TypedDataDomain, TypedDataField, base64DecodeObject } from '@0xsequence/utils'
import { testWalletContext } from '../testutils'

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
  const continueTest = windowURL.searchParams.get('continue')
  const decodedResponse = base64DecodeObject(response) as ProviderMessage<any>

  const session = localStorage.getItem('@sequence.session')

  // If we have a session, continue with tests
  if ((session && continueTest) || (session && response)) {
    const sessionObj = JSON.parse(session)
    const connectDetails: ConnectDetails = {
      connected: true,
      chainId: sessionObj.networks.find(n => n.isDefaultChain).chainId,
      session: sessionObj
    }
    wallet.finalizeConnect(connectDetails)

    // signTypedData on defaultChain test prep
    console.log('... signTypedData on defaultChain ... prep step')

    const address = await wallet.getAddress()
    console.log('... signTypedData on defaultChain ... getAddress', address)
    const chainId = await wallet.getChainId()
    console.log('... signTypedData on defaultChain ... getChainId', chainId)

    const domain: TypedDataDomain = {
      name: 'Ether Mail',
      version: '1',
      chainId: chainId,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const types: { [key: string]: TypedDataField[] } = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ]
    }

    const message = {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    }

    if (!response) {
      console.log('... signTypedData on defaultChain ... sig step')
      await signer.signTypedData(domain, types, message, undefined, undefined, address)
    }

    const sig = decodedResponse.data.result

    if (sig) {
      await test('signTypedData on defaultChain', async () => {
        assert.equal(
          sig,
          '0x00010001c25b59035ea662350e08f41b5087fc49a98b94936826b61a226f97e400c6ce290b8dfa09e3b0df82288fbc599d5b1a023a864bbd876bc67ec1f94c5f2fc4e6101b02',
          'signature match typed-data'
        )

        // // Verify typed data
        // const isValid = await wallet.utils.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
        // assert.true(isValid, 'signature is valid - 3')

        // // Recover config / address
        // const walletConfig = await wallet.utils.recoverWalletConfigFromTypedData(address, { domain, types, message }, sig, chainId)
        // assert.true(walletConfig.address === address, 'recover address - 3')

        // const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
        // assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
      })
    }

    return
  }

  if (!session) {
    // Finalize connect if there is already response
    if (response) {
      console.log('... we have a response...', decodedResponse)
      console.log('... data', JSON.stringify(decodedResponse.data, null, 2))

      if (decodedResponse.type === 'connect') {
        wallet.finalizeConnect(decodedResponse.data as ConnectDetails)

        await test('isConnected', async () => {
          assert.true(wallet.isConnected(), 'is connected')
        })
      }

      // reset url, start with next test
      window.location.href = windowURL.href.split(/[?#]/)[0] + '?continue=true'

      return
    } else {
      // Start connect
      await wallet.connect({ keepWalletOpened: true })
    }
  }
}

// await test('getWalletConfig', async () => {
//   console.log('... getWalletConfig test')
//   const allWalletConfigs = await wallet.getWalletConfig()
//   console.log('allWalletConfigs', allWalletConfigs)
// })

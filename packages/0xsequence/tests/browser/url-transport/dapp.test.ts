import { test, assert } from '../../utils/assert'
import { Wallet, DefaultProviderConfig, BrowserRedirectMessageHooks, ProviderMessage } from '@0xsequence/provider'
import { configureLogger, TypedDataDomain, TypedDataField } from '@0xsequence/utils'
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
  const decodedResponse = base64DecodeObject(response) as ProviderMessage<any>

  const session = localStorage.getItem('@sequence.session')

  // If we have a session, test getting config
  if (session) {
    const sessionObj = JSON.parse(session)
    const connectDetails: ConnectDetails = {
      connected: true,
      chainId: sessionObj.networks.find(n => n.isDefaultChain).chainId,
      session: sessionObj
    }
    wallet.finalizeConnect(connectDetails)

    // await test('getWalletConfig', async () => {
    //   console.log('... getWalletConfig test')
    //   const allWalletConfigs = await wallet.getWalletConfig()
    //   console.log('allWalletConfigs', allWalletConfigs)
    // })

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

  // Connect test
  // if (response) {

  //   console.log('... we have a response...', decoded)
  //   console.log('... data', JSON.stringify(decoded.data, null, 2))

  //   if (decoded.type === 'connect') {
  //     wallet.finalizeConnect(decoded.data as ConnectDetails)

  //     await test('isConnected', async () => {
  //       console.log('d isConnected', wallet.isConnected())

  //       assert.true(wallet.isConnected(), 'is connected')
  //     })
  //   }

  //   return
  // }

  await test('connect / login', async () => {
    const { connected } = await wallet.connect({
      keepWalletOpened: true
    })

    console.log('sup???')

    assert.true(connected, 'is connected')
  })
}

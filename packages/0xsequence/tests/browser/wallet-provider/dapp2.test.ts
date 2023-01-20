import { test, assert } from '../../utils/assert'
import { ethers, TypedDataDomain, TypedDataField } from 'ethers'
import { Wallet, DefaultProviderConfig } from '@0xsequence/provider'
import { configureLogger } from '@0xsequence/utils'
import { deploySequenceContexts } from '@0xsequence/tests/src/context'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {
  //
  // Setup
  //
  const providerConfig = { ...DefaultProviderConfig }
  providerConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'

  //
  // Deploy Sequence WalletContext (deterministic).
  //
  const deployedWalletContext = await (async () => {
    const provider1 = new ethers.providers.JsonRpcProvider('http://localhost:8545')
    const provider2 = new ethers.providers.JsonRpcProvider('http://localhost:9545')
    const signer1 = provider1.getSigner()
    const signer2 = provider2.getSigner()
    return Promise.all([deploySequenceContexts(signer1), deploySequenceContexts(signer2)])
  })()

  console.log('walletContext:', deployedWalletContext)

  const wallet = new Wallet('hardhat2', providerConfig)

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  const provider = wallet.getProvider()!
  const signer = wallet.getSigner()

  // clear it in case we're testing in browser session
  wallet.disconnect()

  await test('is logged out', async () => {
    assert.false(wallet.isConnected(), 'is logged out')
  })

  await test('is disconnected', async () => {
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('connect / login', async () => {
    const { connected } = await wallet.connect({
      keepWalletOpened: true
    })
    assert.true(connected, 'is connected')
  })

  await test('isConnected', async () => {
    assert.true(wallet.isConnected(), 'is connected')
  })

  await test('check defaultNetwork is 31338', async () => {
    assert.equal(await provider.getChainId(), 31338, 'provider chainId is 31338')

    const network = await provider.getNetwork()
    assert.equal(network.chainId, 31338, 'chain id match')
  })

  await test('getNetworks()', async () => {
    const networks = await wallet.getNetworks()
    console.log('=> networks', networks)

    // There should be two chains, hardhat and hardhat2
    assert.equal(networks.length, 2, 'networks length is 2')
    assert.equal(networks[0].chainId, 31337, 'chain id match')
    assert.equal(networks[1].chainId, 31338, 'chain id match')
  })

  await test('signMessage with our custom defaultChain', async () => {
    console.log('signing message...')
    const signer = wallet.getSigner()

    const message = 'Hi there! Please sign this message, 123456789, thanks.'

    // sign
    const sig = await signer.signMessage(message)

    // validate
    const isValid = await wallet.utils.isValidMessageSignature(await wallet.getAddress(), message, sig, await signer.getChainId())
    assert.true(isValid, 'signMessage sig is valid')
  })

  await test('signTypedData on defaultChain (in this case, hardhat2)', async () => {
    const address = await wallet.getAddress()
    const chainId = await wallet.getChainId()

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

    const sig = await signer.signTypedData(domain, types, message)
    assert.equal(
      sig,
      '0x000200000000000289cf4f28dad9e8062b2f4fdeb0463faa334dd7122ae4b50663e7b840f55f8cef03fd11063e67c4ba1b3266f28e53d647b55a641667f9adbe0adc241e8839bff61b02',
      'signature match typed-data dapp'
    )

    // Verify typed data
    const isValid = await wallet.utils.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
    assert.true(isValid, 'signature is valid - 4')
  })
}

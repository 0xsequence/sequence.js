import { DefaultProviderConfig, MemoryItemStore, SequenceClient, SequenceProvider } from '@0xsequence/provider'
import { configureLogger } from '@0xsequence/utils'
import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {
  //
  // Setup
  //
  const transportsConfig = {
    ...DefaultProviderConfig.transports,
    walletAppURL: 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  }

  const hardhatProvider = new ethers.JsonRpcProvider('http://localhost:8545', undefined, { cacheTimeout: -1 })

  const client = new SequenceClient(transportsConfig, new MemoryItemStore(), { defaultChainId: 31338 })
  const provider = new SequenceProvider(client, chainId => {
    if (chainId === 31337) {
      return hardhatProvider
    }

    if (chainId === 31338) {
      return new ethers.JsonRpcProvider('http://localhost:9545', undefined, { cacheTimeout: -1 })
    }

    throw new Error(`No provider for chainId ${chainId}`)
  })

  // clear it in case we're testing in browser session
  provider.disconnect()

  await test('is logged out', async () => {
    assert.false(provider.isConnected(), 'is logged out')
  })

  await test('is disconnected', async () => {
    assert.false(provider.isConnected(), 'is disconnnected')
  })

  await test('connect / login', async () => {
    const { connected } = await provider.connect({
      app: 'test',
      keepWalletOpened: true
    })

    assert.true(connected, 'is connected')
  })

  await test('isConnected', async () => {
    assert.true(provider.isConnected(), 'is connected')
  })

  await test('check defaultNetwork is 31338', async () => {
    assert.equal(provider.getChainId(), 31338, 'provider chainId is 31338')

    const network = await provider.getNetwork()
    assert.equal(network.chainId, 31338n, 'chain id match')
  })

  await test('getNetworks()', async () => {
    const networks = await provider.getNetworks()
    console.log('=> networks', networks)

    // There should be two chains, hardhat and hardhat2
    assert.equal(networks.length, 2, 'networks length is 2')
    assert.equal(networks[0].chainId, 31337, 'chain id match')
    assert.equal(networks[1].chainId, 31338, 'chain id match')
  })

  await test('signMessage with our custom defaultChain', async () => {
    console.log('signing message...')
    const signer = provider.getSigner()

    const message = 'Hi there! Please sign this message, 123456789, thanks.'

    // sign
    const sig = await signer.signMessage(message)

    // validate
    const isValid = await provider.utils.isValidMessageSignature(provider.getAddress(), message, sig, await signer.getChainId())
    assert.true(isValid, 'signMessage sig is valid')
  })

  await test('signTypedData on defaultChain (in this case, hardhat2)', async () => {
    const address = provider.getAddress()
    const chainId = provider.getChainId()

    const domain: ethers.TypedDataDomain = {
      name: 'Ether Mail',
      version: '1',
      chainId: chainId,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const types: { [key: string]: ethers.TypedDataField[] } = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ]
    }

    const message = {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    }

    const sig = await provider.getSigner().signTypedData(domain, types, message)

    // Verify typed data
    const isValid = await provider.utils.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
    assert.true(isValid, 'signature is valid - 4')
  })
}

import { test, assert } from '../../utils/assert'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Wallet, DefaultProviderConfig, Web3Provider } from '@0xsequence/provider'
import { sequenceContext, WalletContext, JsonRpcSender, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'
import { isValidSignature, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { configureLogger, packMessageData } from '@0xsequence/utils'
import { testAccounts, getEOAWallet, deployWalletContext, testWalletContext, sendETH } from '../testutils'

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

  const wallet = new Wallet('hardhat2', providerConfig)

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  const provider = wallet.getProvider()
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

    // There is exactly one default chain
    assert.equal(networks.filter(network => network.isDefaultChain).length, 1, 'there is exactly one default chain')

    // There's exactly one auth chain
    assert.equal(networks.filter(network => network.isAuthChain).length, 1, 'there is exactly one auth chain')

    // The default chain's chain ID is 31338
    assert.equal(networks.filter(network => network.isDefaultChain)[0].chainId, 31338, 'default chain id is 31338')

    // The non-default chain's chain ID is 31337
    assert.equal(networks.filter(network => !network.isDefaultChain)[0].chainId, 31337, 'non-default chain id is 31337')

    // The auth chain's chain ID is 31338
    assert.equal(networks.filter(network => network.isAuthChain)[0].chainId, 31338, 'auth chain id is 31338')

    // The non-auth chain's chain ID is 31337
    assert.equal(networks.filter(network => !network.isAuthChain)[0].chainId, 31337, 'non-auth chain id is 31337')
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

    // recover
    const walletConfig = await wallet.utils.recoverWalletConfigFromMessage(
      await wallet.getAddress(),
      message,
      sig,
      await signer.getChainId()
    )
    assert.equal(walletConfig.address, await wallet.getAddress(), 'signMessage, recovered address ok')
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
      '0x00010001e52e6b56dffd0a295e86eb43e9648de569c44a1036f59030021e9f6e47b581022fe852153d5fa5aa65d243e98f901875ab0a3ad9ea7b3c97fa86ee4886259e331c02',
      'signature match typed-data dapp'
    )

    // Verify typed data
    const isValid = await wallet.utils.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
    assert.true(isValid, 'signature is valid - 4')

    // Recover config / address
    const walletConfig = await wallet.utils.recoverWalletConfigFromTypedData(address, { domain, types, message }, sig, chainId)
    assert.true(walletConfig.address === address, 'recover address - 4')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
  })
}

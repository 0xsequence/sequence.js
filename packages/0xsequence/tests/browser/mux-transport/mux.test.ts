import {
  ProxyMessageProvider, ProviderMessageTransport, ProviderMessage, WalletRequestHandler,
  ProxyMessageChannel, ProxyMessageHandler, Wallet, DefaultProviderConfig, Web3Provider,
  WindowMessageHandler
} from '@0xsequence/provider'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { Networks, WalletContext } from '@0xsequence/network'
import { Wallet as SequenceWallet, Account as SequenceAccount, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { LocalRelayer } from '@0xsequence/relayer'
import { testAccounts, getEOAWallet, testWalletContext } from '../testutils'


// Tests simulates a multi-message provider environment by having a wallet available via the
// proxy channel and wallet window.
export const tests = async () => {

  //
  // Providers
  //
  const provider1 = new JsonRpcProvider('http://localhost:8545')
  const provider2 = new JsonRpcProvider('http://localhost:9545')


  //
  // Deploy Sequence WalletContext (deterministic). We skip deployment
  // as we rely on mock-wallet to deploy it.
  //
  const deployedWalletContext = testWalletContext
  console.log('walletContext:', deployedWalletContext)


  //
  // Proxy Channel (normally would be out-of-band)
  //
  const ch = new ProxyMessageChannel()


  //
  // Wallet Handler (local mock wallet, same a mock-wallet tests)
  //

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  const owner = getEOAWallet(testAccounts[0].privateKey)


  // relayers, account address: 0x3631d4d374c3710c3456d6b1de1ee8745fbff8ba
  // const relayerAccount = getEOAWallet(testAccounts[5].privateKey)
  const relayer1 = new LocalRelayer(getEOAWallet(testAccounts[5].privateKey))
  const relayer2 = new LocalRelayer(getEOAWallet(testAccounts[5].privateKey, provider2))


  // wallet account address: 0x24E78922FE5eCD765101276A422B8431d7151259 based on the chainId
  const swallet = (await SequenceWallet.singleOwner(owner, deployedWalletContext)).connect(provider1, relayer1)

  // Network available list
  const networks: Networks = [
    {
      name: 'hardhat',
      chainId: 31337,
      rpcUrl: provider1.connection.url,
      provider: provider1,
      relayer: relayer1,
      isDefaultChain: true,
      // isAuthChain: true
    },
    {
      name: 'hardhat2',
      chainId: 31338,
      rpcUrl: provider2.connection.url,
      provider: provider2,
      relayer: relayer2,
      isAuthChain: true
    }
  ]

  // Account for managing multi-network wallets
  const saccount = new SequenceAccount({
    initialConfig: swallet.config,
    networks,
    context: deployedWalletContext
  }, owner)

  // the rpc signer via the wallet
  const walletRequestHandler = new WalletRequestHandler(saccount, null, networks)
  
  // register wallet message handler, in this case using the ProxyMessage transport.
  const proxyHandler = new ProxyMessageHandler(walletRequestHandler, ch.wallet)
  proxyHandler.register()

  // register window message transport
  const windowHandler = new WindowMessageHandler(walletRequestHandler)
  windowHandler.register()
  

  //
  // Dapp, wallet provider and dapp tests
  //
  
  // wallet provider with multiple message provider transports enabled
  const wallet = new Wallet('hardhat', {
    walletAppURL: 'http://localhost:9999/mock-wallet/mock-wallet.test.html',
    transports: {
      windowTransport: { enabled: true },
      proxyTransport: { enabled: true, appPort: ch.app }
    }
  })

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  // const provider = wallet.getProvider()
  // const signer = wallet.getSigner()
  
  // clear it in case we're testing in browser session
  wallet.logout()

  await test('is logged out', async () => {
    assert.false(wallet.isLoggedIn(), 'is logged out')
  })

  await test('is disconnected', async () => {
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('login', async () => {
    const loggedIn = await wallet.login()
    assert.true(loggedIn, 'is logged in')
  })

  await test('isConnected', async () => {
    assert.true(wallet.isConnected(), 'is connected')
  })

  let walletContext: WalletContext
  await test('getWalletContext', async () => {
    walletContext = await wallet.getWalletContext()
    assert.equal(walletContext.factory, deployedWalletContext.factory, 'wallet context factory')
    assert.equal(walletContext.guestModule, deployedWalletContext.guestModule, 'wallet context guestModule')
  })

  await test('getChainId', async () => {
    const chainId = await wallet.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('getChainId for other chain', async () => {
    const p = wallet.getProvider(31338)
    assert.equal(await p.getChainId(), 31338, 'chainId of other chain is 31338')
  })

}
 
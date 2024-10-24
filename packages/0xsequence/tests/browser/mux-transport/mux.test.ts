import {
  WalletRequestHandler,
  ProxyMessageChannel,
  ProxyMessageHandler,
  WindowMessageHandler,
  SequenceClient,
  MemoryItemStore
} from '@0xsequence/provider'
import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'
import { NetworkConfig } from '@0xsequence/network'
import { LocalRelayer } from '@0xsequence/relayer'
import { configureLogger } from '@0xsequence/utils'
import { testAccounts, getEOAWallet } from '../testutils'
import * as utils from '@0xsequence/tests'
import { Account } from '@0xsequence/account'
import { Orchestrator } from '@0xsequence/signhub'
import { trackers } from '@0xsequence/sessions'
import { commons } from '@0xsequence/core'

configureLogger({ logLevel: 'DEBUG', silence: false })

// Tests simulates a multi-message provider environment by having a wallet available via the
// proxy channel and wallet window.
export const tests = async () => {
  //
  // Providers
  //
  const provider1 = new ethers.JsonRpcProvider('http://localhost:8545', undefined, { cacheTimeout: -1 })
  const provider2 = new ethers.JsonRpcProvider('http://localhost:9545', undefined, { cacheTimeout: -1 })

  //
  // Deploy Sequence WalletContext (deterministic).
  //
  const deployedWalletContext = await utils.context.deploySequenceContexts(await provider1.getSigner())
  await utils.context.deploySequenceContexts(await provider2.getSigner())
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

  // Network available list
  const networks: NetworkConfig[] = [
    // @ts-ignore
    {
      name: 'hardhat',
      chainId: 31337,
      rpcUrl: provider1._getConnection().url,
      provider: provider1,
      relayer: relayer1,
      isDefaultChain: true
    },
    // @ts-ignore
    {
      name: 'hardhat2',
      chainId: 31338,
      rpcUrl: provider2._getConnection().url,
      provider: provider2,
      relayer: relayer2
    }
  ]

  // Account for managing multi-network wallets
  const saccount = await Account.new({
    networks,
    contexts: deployedWalletContext,
    config: {
      threshold: 1,
      checkpoint: 0,
      signers: [
        {
          address: owner.address,
          weight: 1
        }
      ]
    },
    orchestrator: new Orchestrator([owner]),
    tracker: new trackers.local.LocalConfigTracker(provider1)
  })

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

  // wallet client with multiple message provider transports enabled
  const client = new SequenceClient(
    {
      windowTransport: { enabled: true },
      proxyTransport: { enabled: true, appPort: ch.app }
    },
    new MemoryItemStore(),
    {
      defaultChainId: 31337
    }
  )

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  // const provider = wallet.getProvider()
  // const signer = wallet.getSigner()

  // clear it in case we're testing in browser session
  client.disconnect()

  await test('is disconnected / logged out', async () => {
    assert.false(client.isConnected(), 'is logged out')
  })

  await test('is closed', async () => {
    assert.false(client.isOpened(), 'is closed')
  })

  await test('connect', async () => {
    const { connected } = await client.connect({
      app: 'test',
      keepWalletOpened: true
    })

    assert.true(connected, 'is connected')
  })

  await test('isOpened', async () => {
    assert.true(client.isOpened(), 'is opened')
  })

  await test('isConnected', async () => {
    assert.true(client.isConnected(), 'is connected')
  })

  await test('open wallet while its already opened', async () => {
    // its already opened, but lets do it again
    const opened = await client.openWallet()
    assert.true(opened, 'wallet is opened')
  })

  let walletContext: commons.context.VersionedContext
  await test('getWalletContext', async () => {
    walletContext = await client.getWalletContext()
    assert.equal(walletContext[2].factory, deployedWalletContext[2].factory, 'wallet context factory')
    assert.equal(walletContext[2].guestModule, deployedWalletContext[2].guestModule, 'wallet context guestModule')
  })

  await test('getChainId', async () => {
    const chainId = client.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('switch chains', async () => {
    client.setDefaultChainId(31338)
    assert.equal(client.getChainId(), 31338, 'chainId of other chain is 31338')
  })
}

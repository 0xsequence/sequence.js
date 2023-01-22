import { ethers } from 'ethers'
import { WalletRequestHandler, WindowMessageHandler } from '@0xsequence/provider'
import { Account } from '@0xsequence/account'
import { NetworkConfig } from '@0xsequence/network'
import { LocalRelayer } from '@0xsequence/relayer'
import { configureLogger } from '@0xsequence/utils'

import { testAccounts, getEOAWallet } from '../testutils'
import { test, assert } from '../../utils/assert'
import * as utils from '@0xsequence/tests'
import { Orchestrator } from '@0xsequence/signhub'
import { trackers } from '@0xsequence/sessions'

configureLogger({ logLevel: 'DEBUG', silence: false })

//
// Wallet, a test wallet
//

const main = async () => {
  //
  // Providers
  //
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
  const provider2 = new ethers.providers.JsonRpcProvider('http://localhost:9545')

  //
  // Deploy Sequence WalletContext (deterministic)
  //
  const deployedWalletContext = await utils.context.deploySequenceContexts(provider.getSigner())
  await utils.context.deploySequenceContexts(provider2.getSigner())

  console.log('walletContext:', deployedWalletContext)

  // assert testWalletContext value is correct
  // if (
  //   deployedWalletContext.factory !== testWalletContext.factory ||
  //   deployedWalletContext.guestModule !== testWalletContext.guestModule
  // ) {
  //   throw new Error('deployedWalletContext and testWalletContext do not match. check or regen.')
  // }

  //
  // Setup single owner Sequence wallet
  //

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  const owner = getEOAWallet(testAccounts[0].privateKey)

  // relayers, account address: 0x3631d4d374c3710c3456d6b1de1ee8745fbff8ba
  // const relayerAccount = getEOAWallet(testAccounts[5].privateKey)
  const relayer = new LocalRelayer(getEOAWallet(testAccounts[5].privateKey))
  const relayer2 = new LocalRelayer(getEOAWallet(testAccounts[5].privateKey, provider2))

  // wallet account address: 0xa91Ab3C5390A408DDB4a322510A4290363efcEE9 based on the chainId
  // const wallet = (await Wallet.singleOwner(owner, deployedWalletContext)).connect(provider, relayer)

  // Network available list
  const networks: NetworkConfig[] = [
    {
      name: 'hardhat',
      chainId: 31337,
      rpcUrl: provider.connection.url,
      provider: provider,
      relayer: relayer,
      isDefaultChain: true
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
  // TODO: make this a 3-key multisig with threshold of 2
  // const account = new Account(
  //   {
  //     initialConfig: wallet.config,
  //     networks,
  //     context: deployedWalletContext
  //   },
  //   owner
  // )
  const account = await Account.new({
    config: {
      threshold: 2,
      checkpoint: 0,
      signers: [{
        address: owner.address,
        weight: 2
      }]
    },
    networks,
    contexts: deployedWalletContext,
    orchestrator: new Orchestrator([owner]),
    tracker: new trackers.local.LocalConfigTracker(provider)
  })

  // the json-rpc signer via the wallet
  const walletRequestHandler = new WalletRequestHandler(undefined, null, null, networks)

  // fake/force an async wallet initialization for the wallet-request handler. This is the behaviour
  // of the wallet-webapp, so lets ensure the mock wallet does the same thing too.
  setTimeout(() => {
    walletRequestHandler.signIn(account)
  }, 1000)

  // setup and register window message transport
  const windowHandler = new WindowMessageHandler(walletRequestHandler)
  windowHandler.register()
}

main()

export const tests = async () => {
  // TODO: add tests() method to verify some wallet functionality such a login
  // and adding / removing keys, etc..
  // + mock in a RemoteSigner as well.

  await test('stub', async () => {
    assert.true(true, 'ok')
  })
}

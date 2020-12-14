import { Wallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'

import {
  WalletRequestHandler,
  WindowMessageHandler
} from '@0xsequence/provider'

import { ethereumNetworks } from '@0xsequence/networks'

import { MockWalletUserPrompter } from './utils'

//
//-------------
//


//
// Wallet, a test wallet
//

// TODO: perhaps we take a query param and use one of EOA or SmartWallet signer
// then we run the tests twice..

// our primary provider connected to a network
const provider = new JsonRpcProvider('http://localhost:8545')

// generate a random ethereum wallet..
// TODO: update this to a sequence.Wallet
// const wallet = Wallet.createRandom()
const wallet = Wallet.fromMnemonic('canvas sting blast limb wet reward vibrant paper quality feed wood copper rib divert raise nurse asthma romance exhaust profit beauty anxiety ugly ugly')

// the json-rpc signer via the wallet
const mockUserPrompter = new MockWalletUserPrompter(true)
const walletRequestHandler = new WalletRequestHandler(wallet, provider, mockUserPrompter, ethereumNetworks)


// external window handler + engine.. we may not need the engine, but we can use it if we want
// const sender = new JsonRpcRouter(signingHandler, [loggingProviderMiddleware])
// TODO: lets not do the middleware thing unless we really need it, then can add later..

// in practice, all you have to do is instantiate this, and assign it somewhere
const windowHandler = new WindowMessageHandler(walletRequestHandler)
windowHandler.register()

// TODO: perhaps we put the notifyLogin, notifyNetwork, notifyXXX methods on the WalletHandler ..?
// this way, any message-handler will send this info across..?

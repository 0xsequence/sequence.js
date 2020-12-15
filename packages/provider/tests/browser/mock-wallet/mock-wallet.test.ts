import { Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'

import {
  WalletRequestHandler,
  WindowMessageHandler
} from '@0xsequence/provider'

import { Wallet } from '@0xsequence/wallet'

import { sequenceContext, Networks, ethereumNetworks } from '@0xsequence/network'

import { LocalRelayer } from '@0xsequence/relayer'

// import { MockWalletUserPrompter } from './utils'


//
// Wallet, a test wallet
//

const main = async () => {

  // Setup single owner Sequence wallet
  const owner = EOAWallet.fromMnemonic('canvas sting blast limb wet reward vibrant paper quality feed wood copper rib divert raise nurse asthma romance exhaust profit beauty anxiety ugly ugly')

  const provider = new JsonRpcProvider('http://localhost:8545')
  const relayer = new LocalRelayer(owner)

  const wallet = (await Wallet.singleOwner(sequenceContext, owner)).connect(provider, relayer)
  // NOTE: public wallet address will be 0x5568a201183a4f25561DBe4d58D75b1157dAC256 based on the chainId


  // Network available list
  const networks: Networks = { ...ethereumNetworks }
  networks['ganache'] = {
    name: 'ganache',
    chainId: 31337,
    rpcUrl: 'http://localhost:8545'
  }

  // the json-rpc signer via the wallet
  // const mockUserPrompter = new MockWalletUserPrompter(true)
  const walletRequestHandler = new WalletRequestHandler(wallet, null, networks)


  // external window handler + engine.. we may not need the engine, but we can use it if we want
  // const sender = new JsonRpcRouter(signingHandler, [loggingProviderMiddleware])
  // TODO: lets not do the middleware thing unless we really need it, then can add later..

  // in practice, all you have to do is instantiate this, and assign it somewhere
  const windowHandler = new WindowMessageHandler(walletRequestHandler)
  windowHandler.register()

  // TODO: perhaps we put the notifyLogin, notifyNetwork, notifyXXX methods on the WalletHandler ..?
  // this way, any message-handler will send this info across..?

}

main()


import { ethers, Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
// import { packMessageData, addressOf, compareAddr, isValidSignature, isValidSequenceUndeployedWalletSignature, isValidSequenceDeployedWalletSignature, recoverConfig } from '@0xsequence/wallet'

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

  //
  // Setup single owner Sequence wallet
  //

  const provider = new JsonRpcProvider('http://localhost:8545')

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  let owner = EOAWallet.fromMnemonic('ripple axis someone ridge uniform wrist prosper there frog rate olympic knee')
  owner = owner.connect(provider)

  const relayer = new LocalRelayer(owner)

  // wallet account address: 0x24E78922FE5eCD765101276A422B8431d7151259 based on the chainId
  const wallet = (await Wallet.singleOwner(sequenceContext, owner)).connect(provider, relayer)

  // Network available list
  const networks: Networks = { ...ethereumNetworks }
  networks['ganache'] = {
    name: 'ganache',
    chainId: 31337,
    rpcUrl: 'http://localhost:8545'
  }

  // const txn = await relayer.deployWallet(wallet.config, sequenceContext)
  // console.log('...', txn)


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

  // TODO: register the ProxyMessageHandler() + register()

}

main()
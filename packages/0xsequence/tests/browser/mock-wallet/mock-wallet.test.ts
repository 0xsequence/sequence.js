import { JsonRpcProvider } from '@ethersproject/providers'
import { WalletRequestHandler, WindowMessageHandler } from '@0xsequence/provider'
import { Wallet } from '@0xsequence/wallet'
import { sequenceContext, Networks, sequenceNetworks } from '@0xsequence/network'
import { LocalRelayer } from '@0xsequence/relayer'
import { testAccounts, getEOAWallet, deployWalletContext, testWalletContext } from '../testutils'
// import { MockWalletUserPrompter } from './utils'

//
// Wallet, a test wallet
//

const main = async () => {

  //
  // Deploy Sequence WalletContext (deterministic)
  //
  const deployedWalletContext = await deployWalletContext()
  console.log('walletContext:', deployedWalletContext)

  // assert testWalletContext value is correct
  if (
    deployedWalletContext.factory.toLowerCase() !== testWalletContext.factory.toLowerCase() ||
    deployedWalletContext.guestModule.toLowerCase() !== testWalletContext.guestModule.toLowerCase()
  ) {
    throw new Error('deployedWalletContext and testWalletContext do not match. check or regen.')
  } 


  //
  // Setup single owner Sequence wallet
  //

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  const owner = getEOAWallet(testAccounts[0].privateKey)

  // relayer account address: 0x3631d4d374c3710c3456d6b1de1ee8745fbff8ba
  const relayerAccount = getEOAWallet(testAccounts[5].privateKey)
  const relayer = new LocalRelayer(relayerAccount)

  // wallet account address: 0x24E78922FE5eCD765101276A422B8431d7151259 based on the chainId
  const provider = new JsonRpcProvider('http://localhost:8545')
  const wallet = (await Wallet.singleOwner(owner, deployedWalletContext)).connect(provider, relayer)

  // Network available list
  const networks: Networks = { ...sequenceNetworks }
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

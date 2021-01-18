import { Web3Provider, ProxyMessageProvider, ProviderMessageTransport, ProviderMessage, WalletRequestHandler, ProxyMessageChannel, ProxyMessageHandler } from '@0xsequence/provider'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { sequenceContext, testnetNetworks } from '@0xsequence/network'
import { Wallet, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { LocalRelayer } from '@0xsequence/relayer'
import { testAccounts, getEOAWallet } from '../testutils'


export const tests = async () => {

  const ch = new ProxyMessageChannel()

  //
  // App Provider
  //
  const walletProvider = new ProxyMessageProvider(ch.app)
  walletProvider.register()

  //
  // Wallet Handler
  //

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  const owner = getEOAWallet(testAccounts[0].privateKey)

  // relayer account is same as owner here
  const relayer = new LocalRelayer(owner)

  // wallet account address: 0x24E78922FE5eCD765101276A422B8431d7151259 based on the chainId
  const rpcProvider = new JsonRpcProvider('http://localhost:8545')
  const wallet = (await Wallet.singleOwner(owner)).connect(rpcProvider, relayer)

  // the rpc signer via the wallet
  const walletRequestHandler = new WalletRequestHandler(wallet, null, [])
  
  // register wallet message handler, in this case using the ProxyMessage transport.
  const proxyHandler = new ProxyMessageHandler(walletRequestHandler, ch.wallet)
  proxyHandler.register()

  // setup web3 provider
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()


  await test('verifying getAddress result', async () => {
    assert.equal(address.toLowerCase(), '0x24E78922FE5eCD765101276A422B8431d7151259'.toLowerCase(), 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result == address.toLowerCase(), 'response address check')
    })
  })
}

import { ProxyMessageProvider, ProviderMessageTransport, ProviderMessage, WalletRequestHandler, ProxyMessageChannel, ProxyMessageHandler } from '@0xsequence/provider'
import { ethers, Wallet } from 'ethers'
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { MockWalletUserPrompter } from '../mock-wallet/utils'
import { ethereumNetworks } from '@0xsequence/network'

export const tests = async () => {

  // ProxyMessageChannel object is to be instantiated by the app coordinating
  // the channel, ie. such as the mobile application itself.
  //
  // `ch.app` (port) will be injected into the app, and `ch.wallet` (port) will be injected into the wallet.
  //
  // Sending messages to the app port will go through channel and get received by the wallet.
  // Sending message to the wallet port will go through channel and get received by the app.
  const ch = new ProxyMessageChannel()

  //
  // App Provider
  //
  const provider = new ProxyMessageProvider(ch.app)

  //
  // Wallet Handler
  //
  const jsonRpcProvider = new JsonRpcProvider('http://localhost:8545')

  // generate a random ethereum wallet..
  // TODO: update this to a SmartWallet ..
  // const wallet = Wallet.createRandom()
  const wallet = Wallet.fromMnemonic('canvas sting blast limb wet reward vibrant paper quality feed wood copper rib divert raise nurse asthma romance exhaust profit beauty anxiety ugly ugly')
  
  // the rpc signer via the wallet
  // const mockUserPrompter = new MockWalletUserPrompter(true)
  const walletRequestHandler = new WalletRequestHandler(wallet, jsonRpcProvider, null, ethereumNetworks)
  
  const walletHandler = new ProxyMessageHandler(walletRequestHandler, ch.wallet)
  walletHandler.register()

  //--

  const w3provider = new Web3Provider(provider)
  const signer = w3provider.getSigner()

  const address = await signer.getAddress()

  await test('app sending message', async () => {
    assert.equal(address, '0x0eA6FD9729d8fCB49FfbBBb43172bCa9F27795e7', 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await provider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result == address.toLowerCase(), 'response address check')
    })
  })

  await test('get chain id', async () => {
    const network = await w3provider.getNetwork()
    assert.equal(network.chainId, 31337, 'chain id match')

    const netVersion = await signer.provider.send('net_version', [])
    assert.equal(netVersion, '31337', 'net_version check')

    const chainId = await signer.provider.send('eth_chainId', [])
    assert.equal(chainId, '0x7a69', 'eth_chainId check')
  })

  await test('balance is 0', async () => {
    const balance = await signer.getBalance()
    assert.equal(balance.toNumber(), 0, 'balance is 0')
  })

  // NOTE: when a dapp wants to verify SmartWallet signed messages, they will need to verify against EIP-1271 
  await test('sign a message and recover/validate', async () => {
    const message = ethers.utils.toUtf8Bytes('hihi')

    const sig = await signer.signMessage(message)
    assert.equal(
      sig,
      '0x891a514f009166d93b6b7f49b6d4c86be99316cc1baaa520f8b87f36dcaee78d67386b13178405c10892eb96eb970694408e4067fdbd0de4470ba912cc8f94f81b',
      'signature match'
    )

    const verifyOut = ethers.utils.verifyMessage(message, sig)
    assert.equal(
      verifyOut,
      address,
      'verify address match'
    )

    const digest = ethers.utils.arrayify(ethers.utils.hashMessage(message))
    const recoverOut = ethers.utils.recoverAddress(digest, sig)
    assert.equal(
      recoverOut,
      address,
      'recovered address match'
    )
  })

  // TODO: we need to test wallet notifications from wallet to app..
  // TODO: perhaps we can trigger a network change there..? and notifyNetwork..?

}

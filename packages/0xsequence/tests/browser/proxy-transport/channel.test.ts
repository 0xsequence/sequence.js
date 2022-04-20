import { Web3Provider, ProxyMessageProvider, WalletSession, WalletRequestHandler, ProxyMessageChannel, ProxyMessageHandler, prefixEIP191Message } from '@0xsequence/provider'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { sequenceContext, testnetNetworks } from '@0xsequence/network'
import { Wallet, isValidSignature, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { LocalRelayer } from '@0xsequence/relayer'
import { configureLogger, encodeMessageDigest, packMessageData } from '@0xsequence/utils'
import { testAccounts, getEOAWallet } from '../testutils'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {

  // ProxyMessageChannel object is to be instantiated by the app coordinating
  // the channel, ie. such as the mobile application itself.
  //
  // `ch.app` (port) will be injected into the app, and `ch.wallet` (port) will be injected into the wallet.
  //
  // Sending messages to the app port will go through channel and get received by the wallet.
  // Sending messages to the wallet port will go through channel and get received by the app.
  const ch = new ProxyMessageChannel()

  ch.app.on('open', (openInfo) => {
    console.log('app, wallet opened.', openInfo)
  })
  ch.app.on('close', () => {
    console.log('app, wallet closed.')
  })
  ch.app.on('connect', () => {
    console.log('app, wallet connected.')
  })
  ch.app.on('disconnect', () => {
    console.log('app, wallet disconnected.')
  })
  // ch.wallet.on('open', () => {
  //   console.log('wallet, wallet opened.')
  // })
  // ch.wallet.on('close', () => {
  //   console.log('wallet, wallet closed.')
  // })
  // ch.wallet.on('connect', () => {
  //   console.log('wallet, wallet connected.')
  // })
  // ch.wallet.on('disconnect', () => {
  //   console.log('wallet, wallet disconnected.')
  // })

  //
  // Wallet Handler
  //

  // owner account address: 0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853
  const owner = getEOAWallet(testAccounts[0].privateKey)

  // relayer account is same as owner here
  const relayer = new LocalRelayer(owner)

  // wallet account address: 0xa91Ab3C5390A408DDB4a322510A4290363efcEE9 based on the chainId
  const rpcProvider = new JsonRpcProvider('http://localhost:8545')
  const wallet = (await Wallet.singleOwner(owner)).connect(rpcProvider, relayer)

  const networks = [
    {
      name: 'hardhat',
      chainId: 31337,
      rpcUrl: rpcProvider.connection.url,
      provider: rpcProvider,
      relayer: relayer,
      isDefaultChain: true,
      // isAuthChain: true
    }
  ]

  // the rpc signer via the wallet
  const walletRequestHandler = new WalletRequestHandler(undefined, null, networks)

  // fake/force an async wallet initialization for the wallet-request handler. This is the behaviour
  // of the wallet-webapp, so lets ensure the mock wallet does the same thing too.
  setTimeout(() => {
    walletRequestHandler.signIn(wallet)
  }, 1000)

  // register wallet message handler, in this case using the ProxyMessage transport.
  const proxyHandler = new ProxyMessageHandler(walletRequestHandler, ch.wallet)
  proxyHandler.register()


  //
  // App Provider
  //
  const walletProvider = new ProxyMessageProvider(ch.app)
  walletProvider.register()

  walletProvider.openWallet()
  await walletProvider.waitUntilOpened()

  // setup web3 provider
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()

  await test('verifying getAddress result', async () => {
    assert.equal(address, ethers.utils.getAddress('0xa91Ab3C5390A408DDB4a322510A4290363efcEE9'), 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result == address, 'response address check')
    })
  })

  await test('get chain id', async () => {
    const network = await provider.getNetwork()
    assert.equal(network.chainId, 31337, 'chain id match')

    const netVersion = await signer.provider.send('net_version', [])
    assert.equal(netVersion, '31337', 'net_version check')

    const chainId = await signer.provider.send('eth_chainId', [])
    assert.equal(chainId, '0x7a69', 'eth_chainId check')
  })

  await test('sign a message and validate/recover', async () => {
    const message = ethers.utils.toUtf8Bytes('hihi')

    //
    // Sign the message
    //
    const sig = await signer.signMessage(message)
    assert.equal(
      sig,
      '0x00010001230f8b68557d982f26234c9c7ce4ff35a449392c1e7cbc9a1129268ce2acea40529252535b1caa300e30d53d5c24009cb6f2fafd0e132944016f9472c1a0cc8b1b02',
      'signature match'
    )


    const chainId = await signer.getChainId()

    //
    // Verify the message signature
    //
    // const messageDigest = ethers.utils.arrayify(ethers.utils.keccak256(message))
    const messageDigest = encodeMessageDigest(prefixEIP191Message(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, sequenceContext, chainId)
    assert.true(isValid, 'signature is valid - 1')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, sequenceContext)
    assert.true(recoveredWalletAddress === address, 'recover address - 1')

    const singleSignerAddress = ethers.utils.getAddress('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853') // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
  })

  walletProvider.closeWallet()

}

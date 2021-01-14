import { ProxyMessageProvider, ProviderMessageTransport, ProviderMessage, WalletRequestHandler, ProxyMessageChannel, ProxyMessageHandler } from '@0xsequence/provider'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { sequenceContext, testnetNetworks } from '@0xsequence/network'
import { Wallet, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { LocalRelayer } from '@0xsequence/relayer'
import { testAccounts, getEOAWallet } from '../testutils'


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
  const walletProvider = new ProxyMessageProvider(ch.app)

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
  
  const proxyHandler = new ProxyMessageHandler(walletRequestHandler, ch.wallet)
  proxyHandler.register()

  //--

  // TODO: switch to Sequence Web3Provider ........
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()

  const address = await signer.getAddress()

  await test('verifying getAddress result', async () => {
    assert.equal(address, '0x24E78922FE5eCD765101276A422B8431d7151259', 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result == address.toLowerCase(), 'response address check')
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

    // TODO: signer should be a Sequence signer, and should be able to specify the chainId
    // however, for a single wallet, it can check the chainId and throw if doesnt match, for multi-wallet it will select

    //
    // Sign the message
    //
    const sig = await signer.signMessage(message)
    assert.equal(
      sig,
      '0x000100011ec026ba887f4237db570b1546f9e793fafecbc08df331253b385e35ae7d9107020143f742d3f6768a978b7a4c32b003deb15f3d010805436db1cb9332104d8e1b02',
      'signature match'
    )


    const chainId = await signer.getChainId()

    //
    // Verify the message signature
    //
    const messageDigest = ethers.utils.arrayify(ethers.utils.keccak256(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, sequenceContext, chainId)
    assert.true(isValid, 'signature is valid')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, sequenceContext)
    assert.true(recoveredWalletAddress.toLowerCase() === address.toLowerCase(), 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress.toLowerCase() === walletConfig.signers[0].address.toLowerCase(), 'owner address check')
  })

  // TODO: we need to test wallet notifications from wallet to app..
  // TODO: perhaps we can trigger a network change there..? and notifyNetwork..?

}

import { WindowMessageProvider } from '@0xsequence/provider'
import { ethers } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'

const provider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')

;(window as any).provider = provider

export const tests = async () => {  
  
  provider.openWallet()

  // const sessionPayload = await provider.waitUntilLoggedIn()
  // console.log('GOT SESSION!')
  // console.log(sessionPayload)

  await test('provider connected to wallet', async () => {
    const connected = await provider.waitUntilConnected()
    assert.true(connected, 'connected is true')
  })

  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  const w3provider = new Web3Provider(provider)
  const signer = w3provider.getSigner()

  const address = await signer.getAddress()

  await test('getAddress', async () => {
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

  // TODO: we won't test login here, but we can test signing an EIP-712

  // TODO: signAuthMessage request
  
  // TODO: sign EIP 712

  // TODO: send ETH Transaction ..
  // TODO: first lets get some balance..

  // TODO: send batch transaction

  // TODO: send coins

  // TODO: send collectible

  // TODO: setup all other tests from demo-dapp, just do it..

  // TODO: setup some failure states..? hmm, might be trickier, but maybe could have requestHandler do some faults/other..
}

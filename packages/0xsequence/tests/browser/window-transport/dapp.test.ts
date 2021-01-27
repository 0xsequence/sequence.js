import { WindowMessageProvider } from '@0xsequence/provider'
import { ethers } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'

import { isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { testWalletContext } from '../testutils'

const walletProvider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')
walletProvider.register()

// ;(window as any).walletProvider = walletProvider

export const tests = async () => {  
  
  walletProvider.openWallet()

  await test('provider connected to wallet', async () => {
    const connected = await walletProvider.waitUntilConnected()
    assert.true(connected, 'connected is true')
  })

  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  // ..
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const chainId = await signer.getChainId()

  await test('getAddress', async () => {
    assert.equal(address.toLowerCase(), '0x1abe642a25d9f3a725f07c622abd4356646c1820', 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result[0] === address.toLowerCase(), 'response address check')
    })

    const resp = await provider.send('eth_accounts', [])
    assert.true(!!resp, 'response successful')
    assert.true(resp[0] === address.toLowerCase(), 'response address check')
  })

  await test('get chain id', async () => {
    const network = await provider.getNetwork()
    assert.equal(network.chainId, 31337, 'chain id match')

    const netVersion = await provider.send('net_version', [])
    assert.equal(netVersion, '31337', 'net_version check')

    const chainId = await provider.send('eth_chainId', [])
    assert.equal(chainId, '0x7a69', 'eth_chainId check')

    const chainId2 = await signer.getChainId()
    assert.equal(chainId2, 31337, 'chainId check')
  })

  // NOTE: when a dapp wants to verify SmartWallet signed messages, they will need to verify against EIP-1271 
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
      '0x000100019ba7f3b76f70daa61fef6df01c0dfe6e271536b38808ae74bd8cf168e302ba6f1c997646ad59a775be1d434be81868119fe1b2d4a607f2c18ac8327a578067581c02',
      'signature match'
    )

    //
    // Verify the message signature
    //
    const messageDigest = ethers.utils.arrayify(ethers.utils.keccak256(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext, await signer.getChainId())
    assert.true(isValid, 'signature is valid')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, testWalletContext)
    assert.true(recoveredWalletAddress.toLowerCase() === address.toLowerCase(), 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress.toLowerCase() === walletConfig.signers[0].address.toLowerCase(), 'owner address check')


    // NOTE: below is to verify and recover signature of an EOA account

    // const verifyOut = ethers.utils.verifyMessage(message, sig)
    // assert.equal(
    //   verifyOut,
    //   address,
    //   'verify address match'
    // )

    // const digest = ethers.utils.arrayify(ethers.utils.hashMessage(message))
    // const recoverOut = ethers.utils.recoverAddress(digest, sig)
    // assert.equal(
    //   recoverOut,
    //   address,
    //   'recovered address match'
    // )
  })

  await test('sign EIP712 typed data and validate/recover', async () => {

    const typedData = {
      types: {
        Person: [
          {name: "name", type: "string"},
          {name: "wallet", type: "address"},
        ]
      },
      primaryType: 'Person' as const,
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 31337,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
      },
      message: {
        'name': 'Bob',
        'wallet': '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
      }
    }

    //
    // Sign the message
    //
    const sig = await provider.send('eth_signTypedData', [address, typedData])
    assert.equal(
      sig,
      '0x00010001097d16cab1a08fca49c3d5acae73ecfb4aeaa9051252e698dd7cc2b47f53973e1cc4e0d1855e2134273f62a1c732b500a89ab761acc7625bf4b7ea699365f5b21b02',
      'signature match typed-data'
    )

    // NOTE: verification of message below is identical to verifying a message with eth_sign,
    // the difference is we have to provide 'message' as the typedData digest format

    //
    // Verify the message signature
    //

    const messageHash = ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
    const messageDigest = ethers.utils.arrayify(ethers.utils.keccak256(messageHash))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext, await signer.getChainId())
    assert.true(isValid, 'signature is valid')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, testWalletContext)
    assert.true(recoveredWalletAddress.toLowerCase() === address.toLowerCase(), 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress.toLowerCase() === walletConfig.signers[0].address.toLowerCase(), 'owner address check')
  })
}
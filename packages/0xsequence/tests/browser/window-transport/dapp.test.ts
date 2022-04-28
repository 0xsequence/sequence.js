import { prefixEIP191Message, WindowMessageProvider } from '@0xsequence/provider'
import { ethers } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'

import { isValidSignature, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { configureLogger, encodeMessageDigest, packMessageData } from '@0xsequence/utils'

import { testWalletContext } from '../testutils'

configureLogger({ logLevel: 'DEBUG', silence: false })

const walletProvider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')
walletProvider.register()

// ;(window as any).walletProvider = walletProvider

export const tests = async () => {  
  
  walletProvider.openWallet()

  await test('provider opened the wallet', async () => {
    const opened = await walletProvider.waitUntilOpened()
    assert.true(!!opened, 'opened is true')
  })

  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  // ..
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const chainId = await signer.getChainId()

  await test('getAddress', async () => {
    assert.equal(address, ethers.utils.getAddress('0xa91Ab3C5390A408DDB4a322510A4290363efcEE9'), 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp.result[0] === address, 'response address check')
    })

    const resp = await provider.send('eth_accounts', [])
    assert.true(!!resp, 'response successful')
    assert.true(resp[0] === address, 'response address check')
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
      '0x00010001230f8b68557d982f26234c9c7ce4ff35a449392c1e7cbc9a1129268ce2acea40529252535b1caa300e30d53d5c24009cb6f2fafd0e132944016f9472c1a0cc8b1b02',
      'signature match'
    )

    //
    // Verify the message signature
    //
    const messageDigest = encodeMessageDigest(prefixEIP191Message(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext, await signer.getChainId())
    assert.true(isValid, 'signature is valid - 5')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, testWalletContext)
    assert.true(recoveredWalletAddress === address, 'recover address - 5')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')


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
      '0x00010001c25b59035ea662350e08f41b5087fc49a98b94936826b61a226f97e400c6ce290b8dfa09e3b0df82288fbc599d5b1a023a864bbd876bc67ec1f94c5f2fc4e6101b02',
      'signature match typed-data'
    )

    // NOTE: verification of message below is identical to verifying a message with eth_sign,
    // the difference is we have to provide 'message' as the typedData digest format

    //
    // Verify the message signature
    //

    const messageHash = ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
    const messageDigest = ethers.utils.arrayify(messageHash)
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext, await signer.getChainId())
    assert.true(isValid, 'signature is valid - 6')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)


    //
    // Recover config / address
    //
    const walletConfig = await recoverConfig(subDigest, sig)

    const recoveredWalletAddress = addressOf(walletConfig, testWalletContext)
    assert.true(recoveredWalletAddress === address, 'recover address - 6')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
  })
}
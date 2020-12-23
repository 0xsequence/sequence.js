import { WindowMessageProvider } from '@0xsequence/provider'
import { ethers } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'

import { TypedDataUtils } from 'ethers-eip712'

import { addressOf, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { testWalletContext } from '../testutils'

const walletProvider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')

// ;(window as any).walletProvider = walletProvider

export const tests = async () => {  
  
  walletProvider.openWallet()

  await test('provider connected to wallet', async () => {
    const connected = await walletProvider.waitUntilConnected()
    assert.true(connected, 'connected is true')
  })

  // TODO: switch to sequence Web3Provider(provider)
  // and use the getSequenceSigner()........ or, maybe getSigner()
  // will give us some extra methods, perhaps..?

  // TODO: switch to sequence's Web3Provider + Signer..
  // we don't even have signTypedData here..


  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  const provider = new Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const chainId = await signer.getChainId()

  await test('getAddress', async () => {
    assert.equal(address.toLowerCase(), '0xca736ff96cef0dc9bb7738ed1e68a29df008d68b', 'wallet address')
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
      '0x00010001f95deabe45e000110ffe8db06ff0c7032146e12099580a1542f7befc485b73057415ff9891e0b46c5b5957efe87204112a32afadfa0a8c40d2414d8c7a8877ed1b02',
      'signature match'
    )

    // TODO: .. lets make this more convienient
    // ie.
    // sequence.utils.verifyMessage()
    // sequence.utils.recoverAddress()
    // sequence.utils.recoverConfig()

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
        EIP712Domain: [
          {name: "name", type: "string"},
          {name: "version", type: "string"},
          {name: "chainId", type: "uint256"},
          {name: "verifyingContract", type: "address"},
        ],
        Person: [
          {name: "name", type: "string"},
          {name: "wallet", type: "address"},  
        ]
      },
      primaryType: 'Person' as const,
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 1,
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
      '0x0001000170e843b3554b4be5cdc91c3158d3895150fc822c59b2a8d61e910fec5a390270444cd0d9d27e5afd5cfd0e1717ae5ff28fad0f1e723c06b0ffee737dcd6914021c02',
      'signature match typed-data'
    )

    // TODO: also compute the 'sig' by using the sequence signer directly
    // const sig = await signer.signTypedData(typedData)

    // NOTE: verification of message below is identical to verifying a message with eth_sign,
    // the difference is we have to provide 'message' as the typedData digest format

    //
    // Verify the message signature
    //
    const message = TypedDataUtils.encodeDigest(typedData)
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
  })
}
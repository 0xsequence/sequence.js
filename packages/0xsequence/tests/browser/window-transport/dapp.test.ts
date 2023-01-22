import { isValidSignature, prefixEIP191Message, WindowMessageProvider } from '@0xsequence/provider'
import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'
import { configureLogger, encodeMessageDigest, packMessageData } from '@0xsequence/utils'
import { deploySequenceContexts } from '@0xsequence/tests/src/context'

configureLogger({ logLevel: 'DEBUG', silence: false })

const walletProvider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')
walletProvider.register()

// ;(window as any).walletProvider = walletProvider

export const tests = async () => {  
  const testWalletContext = await (async () => {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
    const signer = provider.getSigner()
    return deploySequenceContexts(signer)
  })()

  walletProvider.openWallet()

  await test('provider opened the wallet', async () => {
    const opened = await walletProvider.waitUntilOpened()
    assert.true(!!opened, 'opened is true')
  })

  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  // ..
  const provider = new ethers.providers.Web3Provider(walletProvider)
  const signer = provider.getSigner()
  const address = await signer.getAddress()
  const chainId = await signer.getChainId()

  await test('getAddress', async () => {
    assert.equal(address, ethers.utils.getAddress('0x0C90b76e8Ca332560f7909dBDB658623919aaA39'), 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    await walletProvider.sendAsync({ jsonrpc: '2.0', id: 88, method: 'eth_accounts', params: [] }, (err, resp) => {
      assert.true(!err, 'error is empty')
      assert.true(!!resp, 'response successful')
      assert.true(resp!.result[0] === address, 'response address check')
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
      '0x0002000000000002dae61fe1d90658f8f4339bd58043b122929cd3f1faaeab38e4daa97b09471170464ebb81bb1957babce03c5fbd0bee815cc61de66d7edaff0d55a4bfbde016e11b02',
      'signature match'
    )

    //
    // Verify the message signature
    //
    const messageDigest = encodeMessageDigest(prefixEIP191Message(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext)
    assert.true(isValid, 'signature is valid - 5')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)
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
      '0x00020000000000022983d84883386d6e3f2749109d0583b11f5c103e68baa763adcd6f7390fa2c4d5f746f239f900cd11f685d5c79314a591646b5ce49336cb48f77583d964753cf1c02',
      'signature match typed-data'
    )

    // NOTE: verification of message below is identical to verifying a message with eth_sign,
    // the difference is we have to provide 'message' as the typedData digest format

    //
    // Verify the message signature
    //

    const messageHash = ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
    const messageDigest = ethers.utils.arrayify(messageHash)
    const isValid = await isValidSignature(address, messageDigest, sig, provider, testWalletContext)
    assert.true(isValid, 'signature is valid - 6')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)
  })
}

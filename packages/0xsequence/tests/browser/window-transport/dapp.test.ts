import { isValidSignature, prefixEIP191Message, WindowMessageProvider } from '@0xsequence/provider'
import { context } from '@0xsequence/tests'
import { configureLogger, encodeMessageDigest, packMessageData } from '@0xsequence/utils'
import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'

configureLogger({ logLevel: 'DEBUG', silence: false })

const walletProvider = new WindowMessageProvider('http://localhost:9999/mock-wallet/mock-wallet.test.html')
walletProvider.register()

// ;(window as any).walletProvider = walletProvider

export const tests = async () => {
  await (async () => {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545', undefined, { cacheTimeout: -1 })
    const signer = await provider.getSigner()
    return context.deploySequenceContexts(signer)
  })()

  walletProvider.openWallet()

  await test('provider opened the wallet', async () => {
    const opened = await walletProvider.waitUntilOpened()
    assert.true(!!opened, 'opened is true')
  })

  // TODO: try this again, but turn off hardhat, to ensure our error reponses are working correctly..
  // ..
  const provider = new ethers.BrowserProvider(walletProvider, undefined, { cacheTimeout: -1 })
  const signer = await provider.getSigner()

  const address = await signer.getAddress()
  const { chainId } = await provider.getNetwork()

  await test('getAddress', async () => {
    assert.true(ethers.isAddress(address), 'wallet address')
  })

  await test('sending a json-rpc request', async () => {
    const result = await walletProvider.request({ method: 'eth_accounts', params: [] })
    assert.equal(result[0], address, 'response address check')

    const resp = await provider.send('eth_accounts', [])
    assert.true(!!resp, 'response successful')
    assert.equal(resp[0], address, 'response address check')
  })

  await test('get chain id', async () => {
    const network = await provider.getNetwork()
    assert.equal(network.chainId, 31337n, 'chain id match')

    const netVersion = await provider.send('net_version', [])
    assert.equal(netVersion, '31337', 'net_version check')

    const chainId = await provider.send('eth_chainId', [])
    assert.equal(chainId, '0x7a69', 'eth_chainId check')
  })

  // NOTE: when a dapp wants to verify SmartWallet signed messages, they will need to verify against EIP-1271
  await test('sign a message and validate/recover', async () => {
    const message = ethers.toUtf8Bytes('hihi')

    // TODO: signer should be a Sequence signer, and should be able to specify the chainId
    // however, for a single wallet, it can check the chainId and throw if doesnt match, for multi-wallet it will select

    // Deploy the wallet (by sending a random tx)
    // (this step is performed by wallet-webapp when signing without EIP-6492 support)
    await signer.sendTransaction({ to: ethers.Wallet.createRandom().address })

    //
    // Sign the message
    //
    const sig = await signer.signMessage(message)

    //
    // Verify the message signature
    //
    const messageDigest = encodeMessageDigest(prefixEIP191Message(message))
    const isValid = await isValidSignature(address, messageDigest, sig, provider)
    assert.true(isValid, 'signature is valid - 5')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)
  })

  await test('sign EIP712 typed data and validate/recover', async () => {
    const typedData = {
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' }
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
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
      }
    }

    //
    // Sign the message
    //
    const sig = await provider.send('eth_signTypedData', [address, typedData])

    // NOTE: verification of message below is identical to verifying a message with eth_sign,
    // the difference is we have to provide 'message' as the typedData digest format

    //
    // Verify the message signature
    //

    const messageHash = ethers.TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
    const messageDigest = ethers.getBytes(messageHash)
    const isValid = await isValidSignature(address, messageDigest, sig, provider)
    assert.true(isValid, 'signature is valid - 6')

    // also compute the subDigest of the message, to be provided to the end-user
    // in order to recover the config properly, the subDigest + sig is required.
    const subDigest = packMessageData(address, chainId, messageDigest)
  })
}

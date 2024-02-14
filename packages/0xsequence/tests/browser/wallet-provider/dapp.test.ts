import { commons, v2 } from '@0xsequence/core'
import { SequenceClient, SequenceProvider, DefaultProviderConfig, MemoryItemStore } from '@0xsequence/provider'
import { context } from '@0xsequence/tests'
import { configureLogger, parseEther } from '@0xsequence/utils'
import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'
import { testAccounts, getEOAWallet, sendETH } from '../testutils'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {
  //
  // Setup
  //
  const transportsConfig = {
    ...DefaultProviderConfig.transports,
    walletAppURL: 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  }

  //
  // Deploy Sequence WalletContext (deterministic).
  //
  const deployedWalletContext = await (async () => {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545', undefined, { cacheTimeout: -1 })
    const signer = await provider.getSigner()
    return context.deploySequenceContexts(signer)
  })()

  const hardhatProvider = new ethers.JsonRpcProvider('http://localhost:8545', undefined, { cacheTimeout: -1 })

  const client = new SequenceClient(transportsConfig, new MemoryItemStore(), { defaultChainId: 31337 })
  const wallet = new SequenceProvider(client, chainId => {
    if (chainId === 31337) {
      return hardhatProvider
    }

    if (chainId === 31338) {
      return new ethers.JsonRpcProvider('http://localhost:9545', undefined, { cacheTimeout: -1 })
    }

    throw new Error(`No provider for chainId ${chainId}`)
  })

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  const provider = wallet.getProvider()
  const signer = wallet.getSigner()

  // clear it in case we're testing in browser session
  await wallet.disconnect()

  await test('is disconnected / logged out', async () => {
    assert.false(wallet.isConnected(), 'is connected')
  })

  await test('is closed', async () => {
    assert.false(wallet.isOpened(), 'is closed')
  })

  await test('is disconnected', async () => {
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('connect', async () => {
    const { connected } = await wallet.connect({
      app: 'test',
      keepWalletOpened: true
    })
    assert.true(connected, 'is connected')
  })

  await test('isOpened', async () => {
    assert.true(wallet.isOpened(), 'is opened')
  })

  await test('isConnected', async () => {
    assert.true(wallet.isConnected(), 'is connected')
  })

  let walletContext: commons.context.VersionedContext
  await test('getWalletContext', async () => {
    walletContext = await wallet.getWalletContext()
    assert.equal(walletContext[1].factory, deployedWalletContext[1].factory, 'wallet context factory')
    assert.equal(walletContext[1].guestModule, deployedWalletContext[1].guestModule, 'wallet context guestModule')
    assert.equal(walletContext[2].factory, deployedWalletContext[2].factory, 'wallet context factory')
    assert.equal(walletContext[2].guestModule, deployedWalletContext[2].guestModule, 'wallet context guestModule')
  })

  await test('getChainId', async () => {
    const chainId = wallet.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('networks', async () => {
    const networks = await wallet.getNetworks()

    assert.equal(networks.length, 2, '2 networks')
    assert.true(networks[0].isDefaultChain!, '1st network is DefaultChain')
    assert.true(!networks[1].isDefaultChain, '1st network is not DefaultChain')
    assert.equal(networks[1].chainId, 31338, 'authChainId is correct')

    const authProvider = wallet.getProvider(31338)!
    assert.equal(authProvider.getChainId(), 31338, 'authProvider chainId is 31338')

    assert.equal(provider.getChainId(), 31337, 'provider chainId is 31337')
  })

  await test('getAddress', async () => {
    const address = wallet.getAddress()
    assert.true(ethers.isAddress(address), 'wallet address is valid')
  })

  await test('getWalletConfig', async () => {
    const allWalletConfigs = await wallet.getWalletConfig()

    const config = allWalletConfigs as v2.config.WalletConfig
    assert.equal(config.version, 2, 'wallet config version is correct')
    assert.equal(BigInt(config.threshold), 2n, 'config, 2 threshold')
    assert.equal(BigInt(config.checkpoint), 0n, 'config, 0 checkpoint')
    assert.true(v2.config.isSignerLeaf(config.tree), 'config, isSignerLeaf')
    assert.true(ethers.isAddress((config.tree as v2.config.SignerLeaf).address), 'config, signer address')
    assert.equal(BigInt((config.tree as v2.config.SignerLeaf).weight), 2n, 'config, signer weight')
  })

  await test('multiple networks', async () => {
    // chainId 31337
    {
      assert.equal(provider.getChainId(), 31337, 'provider chainId is 31337')

      const network = await provider.getNetwork()
      assert.equal(network.chainId, 31337n, 'chain id match')

      const netVersion = await provider.send('net_version', [])
      assert.equal(netVersion, '31337', 'net_version check')

      const chainId = await provider.send('eth_chainId', [])
      assert.equal(chainId, ethers.toQuantity(31337), 'eth_chainId check')

      const chainId2 = await signer.getChainId()
      assert.equal(chainId2, 31337, 'chainId check')
    }

    // chainId 31338
    {
      const provider2 = wallet.getProvider(31338)
      assert.equal(provider2.getChainId(), 31338, '2nd chain, chainId is 31338 - 2')

      const network = await provider2.getNetwork()
      assert.equal(network.chainId, 31338n, '2nd chain, chain id match - 3')

      const netVersion = await provider2.send('net_version', [])
      assert.equal(netVersion, '31338', '2nd chain, net_version check - 4')

      const chainId = await provider2.send('eth_chainId', [])
      assert.equal(chainId, ethers.toQuantity(31338), '2nd chain, eth_chainId check - 5')

      const chainId2 = await provider2.getSigner().getChainId()
      assert.equal(chainId2, 31338, '2nd chain, chainId check - 6')
    }
  })

  await test('listAccounts', async () => {
    const signers = provider.listAccounts()
    assert.equal(signers.length, 1, 'signers, single owner')
    assert.equal(signers[0], wallet.getAddress(), 'signers, check address')
  })

  await test('signMessage on defaultChain', async () => {
    const address = wallet.getAddress()
    const chainId = wallet.getChainId()

    const message = 'hihi'
    const message2 = ethers.toUtf8Bytes(message)

    // Sign the message
    const sigs = await Promise.all(
      [message, message2].map(async m => {
        assert.equal(await signer.getChainId(), 31337, 'signer chainId is 31337')

        // NOTE: below line is equivalent to `signer.signMessage(m)` call
        // const sig = await wallet.utils.signMessage(m)
        const sig = await signer.signMessage(m, { eip6492: true })

        // Non-deployed wallet (with EIP6492) should return a signature
        // that ends with the EIP-6492 magic bytes
        const suffix = '6492649264926492649264926492649264926492649264926492649264926492'
        assert.true(sig.endsWith(suffix), 'signature ends with EIP-6492 magic bytes')

        return sig
      })
    )

    assert.equal(sigs[0], sigs[1], 'signatures should match even if message type is different')

    const sig = sigs[0]

    // Verify the signature
    const isValid = await wallet.utils.isValidMessageSignature(address, message, sig, chainId)
    assert.true(isValid, 'signature is valid - 2')
  })

  await test('signTypedData on defaultChain', async () => {
    const address = wallet.getAddress()
    const chainId = wallet.getChainId()

    const domain: ethers.TypedDataDomain = {
      name: 'Ether Mail',
      version: '1',
      chainId: chainId,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const types: { [key: string]: ethers.TypedDataField[] } = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ]
    }

    const message = {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    }

    const sig = await signer.signTypedData(domain, types, message)

    // Verify typed data
    const isValid = await wallet.utils.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
    assert.true(isValid, 'signature is valid - 3')
  })

  await test('signAuthMessage', async () => {
    const address = wallet.getAddress()
    const chainId = 31337
    const authProvider = wallet.getProvider(chainId)!

    assert.equal(chainId, 31337, 'chainId is 31337 (authChain)')
    assert.equal(authProvider.getChainId(), 31337, 'authProvider chainId is 31337')
    assert.equal(authProvider.getChainId(), await authProvider.getSigner().getChainId(), 'authProvider signer chainId is 31337')

    // Sign the message
    const message = 'hihi'
    const sig = await signer.signMessage(message, { chainId })

    // confirm that authSigner, the chain-bound provider, derived from the authProvider returns the same signature
    const authSigner = authProvider.getSigner()
    const sigChk = await authSigner.signMessage(message, { chainId })
    assert.equal(sigChk, sig, 'authSigner.signMessage returns the same sig')

    // Verify the signature
    const isValid = await wallet.utils.isValidMessageSignature(address, message, sig, chainId)
    assert.true(isValid, 'signAuthMessage, signature is valid')
  })

  await test('getBalance', async () => {
    // technically, the mock-wallet's single signer owner has some ETH..
    const balanceSigner1 = await provider.getBalance('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853')
    assert.true(balanceSigner1 > 0n, 'signer1 balance > 0')
  })

  await test('fund sequence wallet', async () => {
    // fund Sequence wallet with some ETH from test seed account
    const testAccount = getEOAWallet(testAccounts[0].privateKey)
    const walletBalanceBefore = await signer.getBalance()

    const ethAmount = parseEther('10.1234')
    const txResp = await sendETH(testAccount, wallet.getAddress(), ethAmount)
    const txReceipt = await provider.getTransactionReceipt(txResp.hash)
    assert.equal(txReceipt?.status, 1, 'eth sent from signer1')

    const walletBalanceAfter = await signer.getBalance()
    assert.equal(walletBalanceAfter - walletBalanceBefore, ethAmount, `wallet received ${ethAmount} eth`)
  })

  const testSendETH = async (
    title: string,
    opts: {
      gasLimit?: string
    } = {}
  ) =>
    test(title, async () => {
      // sequence wallet to now send some eth back to another seed account
      // via the relayer
      {
        const walletAddress = wallet.getAddress()
        const walletBalanceBefore = await signer.getBalance()

        // send eth from sequence smart wallet to another test account
        const toAddress = testAccounts[1].address
        const toBalanceBefore = await provider.getBalance(toAddress)

        const ethAmount = parseEther('1.4242')

        // NOTE: when a wallet is undeployed (counterfactual), and although the txn contents are to send from our
        // sequence wallet to the test account, the transaction by the Sequence Wallet instance will be sent `to` the
        // `GuestModule` smart contract address of the Sequence context `from` the Sequence Relayer (local) account.
        //
        // However, when a wallet is deployed on-chain, and the txn object is to send from our sequence wallet to the
        // test account, the transaction will be sent `to` the smart wallet contract address of the sender by
        // the relayer. The transaction will then be delegated through the Smart Wallet and transfer will occur
        // as an internal transaction on-chain.
        //
        // Also note, the gasLimit and gasPrice can be estimated by the relayer, or optionally may be specified.

        //--

        // Record wallet deployed state before, so we can check the receipt.to below. We have to do this
        // because a wallet will automatically get bundled for deployment when it sends a transaction.
        const beforeWalletDeployed = (await hardhatProvider.getCode(wallet.getAddress())) !== '0x'

        // NOTE/TODO: gasPrice even if set will be set again by the LocalRelayer, we should allow it to be overridden
        const tx: ethers.TransactionRequest = {
          from: walletAddress,
          to: toAddress,
          value: ethAmount
        }

        // specifying gasLimit manually
        if (opts.gasLimit) {
          tx.gasLimit = opts.gasLimit
        }

        const txResp = await signer.sendTransaction(tx)
        const txReceipt = await txResp.wait()

        assert.equal(txReceipt?.status, 1, 'txn sent successfully')
        assert.true(
          (await hardhatProvider.getCode(wallet.getAddress())) !== '0x',
          'wallet must be in deployed state after the txn'
        )

        // transaction is sent to the deployed wallet, if the wallet is deployed.. otherwise its sent to guestModule
        if (beforeWalletDeployed) {
          assert.equal(txReceipt?.to, wallet.getAddress(), 'recipient is correct')
        } else {
          assert.equal(txReceipt?.to, walletContext[2].guestModule, 'recipient is correct')
        }

        // Ensure fromAddress sent their eth
        const walletBalanceAfter = await signer.getBalance()
        const sent = (walletBalanceAfter - walletBalanceBefore) * -1n

        assert.equal(sent, ethAmount, `wallet sent ${sent} eth while expected ${ethAmount}`)

        // Ensure toAddress received their eth
        const toBalanceAfter = await provider.getBalance(toAddress)
        const received = toBalanceAfter - toBalanceBefore
        assert.equal(received, ethAmount, `toAddress received ${received} eth while expected ${ethAmount}`)

        // Extra checks
        if (opts.gasLimit) {
          // In our test, we are passing a high gas limit for an internal transaction, so overall
          // transaction must be higher than this value if it used our value correctly
          assert.true(txResp.gasLimit >= BigInt(opts.gasLimit), 'sendETH, using higher gasLimit')
        }
      }
    })

  await testSendETH('sendETH (defaultChain)')

  // NOTE: this will pass, as we set the gasLimit low on the txn, but the LocalRelayer will re-estimate
  // the entire transaction to have it pass.
  await testSendETH('sendETH with high gasLimit override (defaultChain)', { gasLimit: '0x55555' })

  await test('sendTransaction batch', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = parseEther('1.234')
    const ethAmount2 = parseEther('0.456')

    const tx1: ethers.TransactionRequest = {
      to: testAccount.address,
      value: ethAmount1
    }
    const tx2: ethers.TransactionRequest = {
      to: testAccount.address,
      value: ethAmount2
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)
    const txnResp = await signer.sendTransaction([tx1, tx2])

    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    const sent = toBalanceAfter - toBalanceBefore
    const expected = ethAmount1 + ethAmount2
    assert.equal(sent, expected, `wallet sent ${sent} eth while expected ${expected} (${ethAmount1} + ${ethAmount2})`)
  })

  await test('sendTransaction batch format 2', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = parseEther('1.234')
    const ethAmount2 = parseEther('0.456')

    const tx1: ethers.TransactionRequest = {
      to: testAccount.address,
      value: ethAmount1
    }

    const tx2: ethers.TransactionRequest = {
      to: testAccount.address,
      value: ethAmount2
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)
    const txnResp = await signer.sendTransaction([tx1, tx2])

    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    const sent = toBalanceAfter - toBalanceBefore
    const expected = ethAmount1 + ethAmount2
    assert.equal(sent, expected, `wallet sent ${sent} eth while expected ${expected} (${ethAmount1} + ${ethAmount2})`)
  })

  await test('sendTransaction batch format 3', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = parseEther('1.234')
    const ethAmount2 = parseEther('0.456')

    const tx1: commons.transaction.Transaction = {
      to: testAccount.address,
      value: ethAmount1
    }

    const tx2: commons.transaction.Transaction = {
      to: testAccount.address,
      value: ethAmount2
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)

    const txnResp = await signer.sendTransaction([tx1, tx2])
    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    const sent = toBalanceAfter - toBalanceBefore
    const expected = ethAmount1 + ethAmount2
    assert.equal(sent, expected, `wallet sent ${sent} eth while expected ${expected} (${ethAmount1} + ${ethAmount2})`)
  })

  await test('sendETH from the sequence smart wallet (authChain)', async () => {
    // multi-chain to send eth on an alternative chain, in this case the authChain
    //
    // NOTE: the account addresses are both chains have been seeded with the same private key
    // so we can have overlapping addresses and keys for ease of use duringtesting

    // get provider of the 2nd chain
    const provider2 = wallet.getProvider('hardhat2')!

    assert.equal(provider2.getChainId(), 31338, 'provider is the 2nd chain - 1')
    assert.equal(provider2.getChainId(), wallet.getProvider(31338)!.getChainId(), 'provider2 code path check')

    const signer2 = provider2.getSigner()

    // confirm all account addresses are the same and correct
    {
      assert.equal(wallet.getAddress(), await signer.getAddress(), 'wallet and signer address match')
      assert.equal(wallet.getAddress(), await signer2.getAddress(), 'wallet and signer2 address match')
      assert.true(wallet.getAddress() !== testAccounts[0].address, 'wallet is not subkey address')
    }

    // initial balances
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey, provider2)
      const walletBalanceBefore = await provider2.getBalance(await testAccount.getAddress())

      const mainTestAccount = getEOAWallet(testAccounts[0].privateKey, wallet.getProvider())
      const mainWalletBalanceBefore = await provider.getBalance(await mainTestAccount.getAddress())

      assert.true(walletBalanceBefore !== mainWalletBalanceBefore, 'balances across networks do not match')
    }

    // first, lets move some ETH info the wallet from teh testnet seed account
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey, provider2)
      const walletBalanceBefore = await signer2.getBalance()

      const ethAmount = parseEther('4.2')

      // const txResp = await sendETH(testAccount, await wallet.getAddress(), ethAmount)
      // const txReceipt = await provider2.getTransactionReceipt(txResp.hash)

      const txReceipt = await (await sendETH(testAccount, wallet.getAddress(), ethAmount)).wait()
      assert.equal(txReceipt?.status, 1, 'eth sent')

      const walletBalanceAfter = await signer2.getBalance()
      assert.equal(walletBalanceAfter - walletBalanceBefore, ethAmount, `wallet received ${ethAmount} eth`)
    }

    // using sequence wallet on the authChain, send eth back to anotehr seed account via
    // the authChain relayer
    {
      const walletAddress = wallet.getAddress()
      const walletBalanceBefore = await signer2.getBalance()

      // send eth from sequence smart wallet to another test account
      const toAddress = testAccounts[1].address
      const toBalanceBefore = await provider2.getBalance(toAddress)

      const ethAmount = parseEther('1.1234')

      const tx = {
        from: walletAddress,
        to: toAddress,
        value: ethAmount
      }
      const txReceipt = await (await signer2.sendTransaction(tx)).wait()

      assert.equal(txReceipt?.status, 1, 'txn sent successfully')
      assert.true((await hardhatProvider.getCode(walletAddress)) !== '0x', 'wallet must be in deployed state after the txn')

      // Ensure fromAddress sent their eth
      const walletBalanceAfter = await signer2.getBalance()
      const sent = (walletBalanceAfter - walletBalanceBefore) * -1n

      assert.equal(sent, ethAmount, `wallet sent ${ethAmount} eth`)

      // Ensure toAddress received their eth
      const toBalanceAfter = await provider2.getBalance(toAddress)
      assert.equal(toBalanceAfter - toBalanceBefore, ethAmount, `toAddress received ${ethAmount} eth`)
    }
  })
}

import { test, assert } from '../../utils/assert'
import { ethers } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { Wallet, DefaultProviderConfig } from '@0xsequence/provider'
import { WalletContext } from '@0xsequence/network'
import { testAccounts, getEOAWallet, testWalletContext, sendETH } from '../testutils'
import { Transaction, TransactionRequest } from '@0xsequence/transactions'

export const tests = async () => {

  //
  // Deploy Sequence WalletContext (deterministic). We skip deployment
  // as we rely on mock-wallet to deploy it.
  //
  const deployedWalletContext = testWalletContext
  console.log('walletContext:', deployedWalletContext)

  //
  // Setup
  //
  const providerConfig = { ...DefaultProviderConfig }
  providerConfig.walletAppURL = 'http://localhost:9999/mock-wallet/mock-wallet.test.html'
  providerConfig.networks = [{
    name: 'hardhat', rpcUrl: 'http://0.0.0.0:8545'
  }]
  
  const wallet = new Wallet('hardhat', providerConfig)

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the defaultChain
  const provider = wallet.getProvider()
  const signer = wallet.getSigner()
  
  // clear it in case we're testing in browser session
  wallet.logout()

  await test('is logged out', async () => {
    assert.false(wallet.isLoggedIn(), 'is logged out')
  })

  await test('is disconnected', async () => {
    assert.false(wallet.isConnected(), 'is disconnnected')
  })

  await test('login', async () => {
    const loggedIn = await wallet.login()
    assert.true(wallet.isConnected(), 'before login, is connected')
    assert.true(loggedIn, 'is logged in')
  })

  await test('isConnected', async () => {
    assert.true(wallet.isConnected(), 'is connected')
  })

  let walletContext: WalletContext
  await test('getWalletContext', async () => {
    walletContext = await wallet.getWalletContext()
    assert.equal(walletContext.factory, deployedWalletContext.factory, 'wallet context factory')
    assert.equal(walletContext.guestModule, deployedWalletContext.guestModule, 'wallet context guestModule')
  })

  await test('getChainId', async () => {
    const chainId = await wallet.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('networks', async () => {
    const networks = await wallet.getNetworks()

    assert.equal(networks.length, 2, '2 networks')
    assert.true(networks[0].isDefaultChain, '1st network is DefaultChain')
    assert.true(!networks[0].isAuthChain, '1st network is not AuthChain')
    assert.true(!networks[1].isDefaultChain, '1st network is not DefaultChain')
    assert.true(networks[1].isAuthChain, '2nd network is AuthChain')
    assert.true(networks[1].chainId === 31338, 'authChainId is correct')

    const authNetwork = await wallet.getAuthNetwork()
    assert.equal(networks[1].chainId, authNetwork.chainId, 'authNetwork matches chainId')

    const authProvider = wallet.getProvider(authNetwork)
    assert.equal(await authProvider.getChainId(), 31338, 'authProvider chainId is 31338')

    assert.equal(await provider.getChainId(), 31337, 'provider chainId is 31337')
  })

  await test('getAccounts', async () => {
    const address = await wallet.getAddress()
    assert.equal(address, ethers.utils.getAddress('0xf4c293EdEd54005F3566421f44f418Be9e484C15'), 'wallet address is correct')
  })

  await test('getWalletConfig', async () => {
    const allWalletConfigs = await wallet.getWalletConfig()
    assert.equal(allWalletConfigs.length, 2, '2 wallet configs (one for each chain)')

    const config1 = allWalletConfigs[0]
    assert.true(config1.chainId !== undefined, 'config1, chainId is set')
    assert.true(config1.threshold === 1, 'config1, 1 threshold')
    assert.true(config1.signers.length === 1, 'config1, 1 signer')
    assert.true(config1.signers[0].address === '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853', 'config1, signer address')
    assert.true(config1.signers[0].weight === 1, 'config1, signer weight')

    const config2 = allWalletConfigs[0]
    assert.true(config2.chainId !== undefined, 'config2, chainId is set')
    assert.true(config2.threshold === 1, 'config2, 1 threshold')
    assert.true(config2.signers.length === 1, 'config2, 1 signer')
    assert.true(config2.signers[0].address === '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853', 'config2, signer address')
    assert.true(config2.signers[0].weight === 1, 'config2, signer weight')
  })

  await test('getWalletState', async () => {
    const allWalletStates = await signer.getWalletState()
    assert.equal(allWalletStates.length, 2, '2 wallet states (one for each chain)')

    // we expect network order to be [defaultChain, authChain, ..], so chain 31337 will be at index 0
    const state1 = allWalletStates[0]
    assert.true(state1.chainId === 31337, 'state1, chainId is 31337')
    assert.true(state1.config.threshold === 1, 'state1, threshold')
    assert.true(state1.config.signers.length === 1, 'state1, 1 signer')
    assert.true(state1.address === await wallet.getAddress(), 'state1, address')
    // assert.true(state1.deployed, 'state1, deployed')
    // assert.true(state1.publishedLatest, 'state1, publishedLatest')
  })

  await test('multiple networks', async () => {
    // chainId 31337
    {
      assert.equal(await provider.getChainId(), 31337, 'provider chainId is 31337')

      const network = await provider.getNetwork()
      assert.equal(network.chainId, 31337, 'chain id match')
  
      const netVersion = await provider.send('net_version', [])
      assert.equal(netVersion, '31337', 'net_version check')
  
      const chainId = await provider.send('eth_chainId', [])
      assert.equal(chainId, '0x7a69', 'eth_chainId check')
  
      const chainId2 = await signer.getChainId()
      assert.equal(chainId2, 31337, 'chainId check')
    }

    // chainId 31338
    {
      const provider2 = await wallet.getProvider(31338)
      assert.equal(await provider2.getChainId(), 31338, '2nd chain, chainId is 31338')

      const network = await provider2.getNetwork()
      assert.equal(network.chainId, 31338, '2nd chain, chain id match')
  
      const netVersion = await provider2.send('net_version', [])
      assert.equal(netVersion, '31338', '2nd chain, net_version check')
  
      const chainId = await provider2.send('eth_chainId', [])
      assert.equal(chainId, '0x7a6a', '2nd chain, eth_chainId check')
  
      const chainId2 = await (await provider2).getSigner().getChainId()
      assert.equal(chainId2, 31338, '2nd chain, chainId check')
    }
  })

  await test('getSigners', async () => {
    const signers = await signer.getSigners()
    assert.true(signers.length === 1, 'signers, single owner')
    assert.true(signers[0] === '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853', 'signers, check address')
  })

  await test('signMessage on defaultChain', async () => {
    const address = await wallet.getAddress()
    const chainId = await wallet.getChainId()

    const message = 'hihi'
    const message2 = ethers.utils.toUtf8Bytes('hihi')

    // Sign the message
    const sigs = await Promise.all([message, message2].map(async m => {
      // NOTE: below line is equivalent to `signer.signMessage(m)` call
      // const sig = await wallet.commands.signMessage(m)
      const sig = await signer.signMessage(m)
      assert.equal(
        sig,
        '0x0001000161413429921f2035779d24c7c383f78f02f40317e0e28095ceeebababa1a7d7651cc212313bd355737fe6d0b6ce0428cafe8dc418ae82af46167ab993bd753d01c02',
        'signature match'
      )
      return sig
    }))
    const sig = sigs[0]

    // Verify the signature
    const isValid = await wallet.commands.isValidMessageSignature(address, message, sig, chainId)
    assert.true(isValid, 'signature is valid')

    // Recover the address / config from the signature
    const walletConfig = await wallet.commands.recoverWalletConfigFromMessage(address, message, sig, chainId)
    assert.true(walletConfig.address === address, 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
  })

  await test('signTypedData on defaultChain', async () => {
    const address = await wallet.getAddress()
    const chainId = await wallet.getChainId()

    const domain: TypedDataDomain = {
      name: 'Ether Mail',
      version: '1',
      chainId: chainId,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const types: {[key: string] : TypedDataField[]} = {
      'Person': [
        {name: "name", type: "string"},
        {name: "wallet", type: "address"}
      ]
    }

    const message = {
      'name': 'Bob',
      'wallet': '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    }

    const sig = await signer.signTypedData(domain, types, message)
    assert.equal(
      sig,
      '0x000100013749d9388b1f0f7fd793d2d80c3062015210c7261313263d0afa2ead01b5465a5d62a5c12da7fa1c08583dac983d0ff257508e6768c82084cb0582d7160f48541c02',
      'signature match typed-data'
    )

    // Verify typed data
    const isValid = await wallet.commands.isValidTypedDataSignature(address, { domain, types, message }, sig, chainId)
    assert.true(isValid, 'signature is valid')

    // Recover config / address
    const walletConfig = await wallet.commands.recoverWalletConfigFromTypedData(address, { domain, types, message }, sig, chainId)
    assert.true(walletConfig.address === address, 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')
  })

  await test('signAuthMessage', async () => {
    // NOTE: by definition, signAuthMessage will always be directed at the authChain network
    const authNetwork = await wallet.getAuthNetwork()

    const address = await wallet.getAddress()
    const chainId = authNetwork.chainId
    const authProvider = wallet.getProvider(authNetwork)

    assert.equal(chainId, 31338, 'chainId is 31338 (authChain)')
    assert.equal(await authProvider.getChainId(), 31338, 'authProvider chainId is 31338')
    assert.equal(await authProvider.getChainId(), await authProvider.getSigner().getChainId(), 'authProvider signer chainId is 31338')

    // Sign the message
    const message = 'hihi'
    const sig = await signer.signMessage(message, chainId)
    assert.equal(
      sig,
      '0x0001000138519ea0b0b8c8d38f987b2dc2a6df425cf5febc6a6595dd1c566609e217edeb546cc02c754fe66c333fb880d1fa2e82c41a9afb001e625a716bcc1ff9f096191b02',
      'signAuthMessage, signature match'
    )

    // confirm that authSigner, the chain-bound provider, derived from the authProvider returns the same signature
    const authSigner = authProvider.getSigner()
    const sigChk = await authSigner.signMessage(message, chainId)
    assert.equal(sigChk, sig, 'authSigner.signMessage returns the same sig')

    const sigChk2 = await wallet.commands.signAuthMessage(message)
    assert.equal(sigChk2, sig, 'wallet.commands.signAuthMessage returns the same sig')

    // Verify the signature
    const isValid = await wallet.commands.isValidMessageSignature(address, message, sig, chainId)
    assert.true(isValid, 'signAuthMessage, signature is valid')

    // Recover the address / config from the signature
    const walletConfig = await wallet.commands.recoverWalletConfigFromMessage(address, message, sig, chainId)
    assert.true(walletConfig.address === address, 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress === walletConfig.signers[0].address, 'owner address check')    
  })
  
  await test('getBalance', async () => {
    // technically, the mock-wallet's single signer owner has some ETH..
    const balanceSigner1 = await provider.getBalance('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853')
    assert.true(balanceSigner1.gt(ethers.BigNumber.from(0)), 'signer1 balance > 0')
  })

  await test('fund sequence wallet', async () => {
    // fund Sequence wallet with some ETH from test seed account
    const testAccount = getEOAWallet(testAccounts[0].privateKey)
    const walletBalanceBefore = await signer.getBalance()

    const ethAmount = ethers.utils.parseEther('10.1234')
    const txResp = await sendETH(testAccount, await wallet.getAddress(), ethAmount)
    const txReceipt = await provider.getTransactionReceipt(txResp.hash)
    assert.true(txReceipt.status === 1, 'eth sent from signer1')

    const walletBalanceAfter = await signer.getBalance()
    assert.true(walletBalanceAfter.sub(walletBalanceBefore).eq(ethAmount), `wallet received ${ethAmount} eth`)
  })

  const testSendETH = async (title: string, opts: {
    gasLimit?: string
  } = {}) => test(title, async () => {
    // sequence wallet to now send some eth back to another seed account
    // via the relayer
    {
      const walletAddress = wallet.getAddress()
      const walletBalanceBefore = await signer.getBalance()


      // send eth from sequence smart wallet to another test account
      const toAddress = testAccounts[1].address
      const toBalanceBefore = await provider.getBalance(toAddress)

      const ethAmount = ethers.utils.parseEther('1.4242')

      // NOTE: when a wallet is undeployed (counter-factual), and although the txn contents are to send from our
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
      const beforeWalletDeployed = await wallet.isDeployed()

      // NOTE/TODO: gasPrice even if set will be set again by the LocalRelayer, we should allow it to be overridden
      const tx: TransactionRequest = {
        from: await walletAddress,
        to: toAddress,
        value: ethAmount,
      }

      // specifying gasLimit manually
      if (opts.gasLimit) {
        tx.gasLimit = opts.gasLimit
      }

      const txResp = await signer.sendTransaction(tx)
      const txReceipt = await txResp.wait()

      assert.true(txReceipt.status === 1, 'txn sent successfully')
      assert.true(await signer.isDeployed(), 'wallet must be in deployed state after the txn')

      // transaction is sent to the deployed wallet, if the wallet is deployed.. otherwise its sent to guestModule
      if (beforeWalletDeployed) {
        assert.equal(txReceipt.to, await wallet.getAddress(), 'recipient is correct')
      } else {
        assert.equal(txReceipt.to, walletContext.guestModule, 'recipient is correct')
      }

      // Ensure fromAddress sent their eth
      const walletBalanceAfter = await signer.getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).mul(-1).eq(ethAmount), `wallet sent ${ethAmount} eth`)

      // Ensure toAddress received their eth
      const toBalanceAfter = await provider.getBalance(toAddress)
      assert.true(toBalanceAfter.sub(toBalanceBefore).eq(ethAmount), `toAddress received ${ethAmount} eth`)

      // Extra checks
      if (opts.gasLimit) {
        // In our test, we are passing a high gas limit for an internal transaction, so overall
        // transaction must be higher than this value if it used our value correctly
        assert.true(txResp.gasLimit.gte(opts.gasLimit), 'sendETH, using higher gasLimit')
      }
    }
  })

  await testSendETH('sendETH (defaultChain)')

  // NOTE: this will pass, as we set the gasLimit low on the txn, but the LocalRelayer will re-estimate
  // the entire transaction to have it pass.
  await testSendETH('sendETH with high gasLimit override (defaultChain)', { gasLimit: '0x55555' })

  await test('sendTransaction batch', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = ethers.utils.parseEther('1.234')
    const ethAmount2 = ethers.utils.parseEther('0.456')

    const tx1: TransactionRequest = {
      to: testAccount.address,
      value: ethAmount1,
      data: '0x'
    }
    const tx2: TransactionRequest = {
      to: testAccount.address,
      value: ethAmount2,
      data: '0x'
    }
    const txBatched = {
      ...tx1,
      auxiliary: [tx2]
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)
    const txnResp = await signer.sendTransaction(txBatched)

    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    assert.true(toBalanceAfter.sub(toBalanceBefore).mul(1).eq(ethAmount1.add(ethAmount2)), `wallet sent ${ethAmount1} + ${ethAmount2} eth`)
  })

  await test('sendTransaction batch format 2', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = ethers.utils.parseEther('1.234')
    const ethAmount2 = ethers.utils.parseEther('0.456')

    const tx1: TransactionRequest = {
      to: testAccount.address,
      value: ethAmount1,
      data: '0x'
    }

    const tx2: TransactionRequest = {
      to: testAccount.address,
      value: ethAmount2,
      data: '0x'
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)
    const txnResp = await signer.sendTransactionBatch([tx1, tx2])

    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    assert.true(toBalanceAfter.sub(toBalanceBefore).mul(1).eq(ethAmount1.add(ethAmount2)), `wallet sent ${ethAmount1} + ${ethAmount2} eth`)
  })

  await test('sendTransaction batch format 3', async () => {
    const testAccount = getEOAWallet(testAccounts[1].privateKey)

    const ethAmount1 = ethers.utils.parseEther('1.234')
    const ethAmount2 = ethers.utils.parseEther('0.456')

    const tx1: Transaction = {
      delegateCall: false,
      revertOnError: false,
      gasLimit: '0x55555',
      to: testAccount.address,
      value: ethAmount1,
      data: '0x'
    }

    const tx2: Transaction = {
      delegateCall: false,
      revertOnError: false,
      gasLimit: '0x55555',
      to: testAccount.address,
      value: ethAmount2,
      data: '0x'
    }

    const toBalanceBefore = await provider.getBalance(testAccount.address)
    const txnResp = await signer.sendTransactionBatch([tx1, tx2])

    await txnResp.wait()

    const toBalanceAfter = await provider.getBalance(testAccount.address)
    assert.true(toBalanceAfter.sub(toBalanceBefore).mul(1).eq(ethAmount1.add(ethAmount2)), `wallet sent ${ethAmount1} + ${ethAmount2} eth`)
  })

  await test('sendETH from the sequence smart wallet (authChain)', async () => {
    // multi-chain to send eth on an alternative chain, in this case the authChain
    //
    // NOTE: the account addresses are both chains have been seeded with the same private key
    // so we can have overlapping addresses and keys for ease of use duringtesting

    // get provider of the 2nd chain (the authChain)
    const provider2 = wallet.getProvider('hardhat2')
    assert.equal(await provider2.getChainId(), 31338, 'provider is the 2nd chain')
    assert.equal(await provider2.getChainId(), await wallet.getProvider(31338).getChainId(), 'provider2 code path check')

    const authProvider = await wallet.getAuthProvider()
    assert.equal(await provider2.getChainId(), await authProvider.getChainId(), 'provider2 === authProvider')

    const signer2 = provider2.getSigner()

    // confirm all account addresses are the same and correct
    {
      assert.equal(await wallet.getAddress(), await signer.getAddress(), 'wallet and signer address match')
      assert.equal(await wallet.getAddress(), await signer2.getAddress(), 'wallet and signer2 address match')
      assert.true(await wallet.getAddress() !== testAccounts[0].address, 'wallet is not subkey address')
    }

    // initial balances
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey, provider2)
      const walletBalanceBefore = await testAccount.getBalance()

      const mainTestAccount = getEOAWallet(testAccounts[0].privateKey, wallet.getProvider())
      const mainWalletBalanceBefore = await mainTestAccount.getBalance()

      assert.true(walletBalanceBefore.toString() !== mainWalletBalanceBefore.toString(), 'balances across networks do not match')

      // test different code paths lead to same results
      assert.equal(
        (await provider2.getBalance(await testAccount.getAddress())).toString(),
        (await testAccount.getBalance()).toString(),
        'balance match 1'
      )
      assert.equal(
        (await provider.getBalance(await mainTestAccount.getAddress())).toString(),
        (await mainTestAccount.getBalance()).toString(),
        'balance match 2'
      )
    }

    // first, lets move some ETH info the wallet from teh testnet seed account
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey, provider2)
      const walletBalanceBefore = await signer2.getBalance()

      const ethAmount = ethers.utils.parseEther('4.2')

      // const txResp = await sendETH(testAccount, await wallet.getAddress(), ethAmount)
      // const txReceipt = await provider2.getTransactionReceipt(txResp.hash)

      const txReceipt = await (await sendETH(testAccount, await wallet.getAddress(), ethAmount)).wait()
      assert.true(txReceipt.status === 1, 'eth sent')

      const walletBalanceAfter = await signer2.getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).eq(ethAmount), `wallet received ${ethAmount} eth`)
    }

    // using sequence wallet on the authChain, send eth back to anotehr seed account via
    // the authChain relayer
    {
      const walletAddress = wallet.getAddress()
      const walletBalanceBefore = await signer2.getBalance()

      // send eth from sequence smart wallet to another test account
      const toAddress = testAccounts[1].address
      const toBalanceBefore = await provider2.getBalance(toAddress)
      
      const ethAmount = ethers.utils.parseEther('1.1234')

      const tx = {
        from: walletAddress,
        to: toAddress,
        value: ethAmount,
      }
      const txReceipt = await (await signer2.sendTransaction(tx)).wait()

      assert.true(txReceipt.status === 1, 'txn sent successfully')
      assert.true(await signer2.isDeployed(), 'wallet must be in deployed state after the txn')

      // Ensure fromAddress sent their eth
      const walletBalanceAfter = await signer2.getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).mul(-1).eq(ethAmount), `wallet sent ${ethAmount} eth`)

      // Ensure toAddress received their eth
      const toBalanceAfter = await provider2.getBalance(toAddress)
      assert.true(toBalanceAfter.sub(toBalanceBefore).eq(ethAmount), `toAddress received ${ethAmount} eth`)
    }
  })
  
}


// TODO: send coins

// TODO: send collectible

// TODO: setup some failure states..? hmm, might be trickier, but maybe could have requestHandler do some faults/other..

// TODO: add auth helpers to @0xsequence/auth, and heplers in "commands"

//
//--------
//

// import { sequence} from '@0xsequence'

// const wallet = new sequence.Wallet()
// wallet.login()

// wallet.sendETH()
// wallet.signMessage()

// wallet.sendTransaction(...)

// const tokens = new sequence.Tokens()

// tokens.mintCoin(xx)
// tokens.mintCollectible()

// wallet.sendTransaction(tokens.mintCoin(xx))
// wallet.sendTransaction(tokens.mintCollectible(xx))

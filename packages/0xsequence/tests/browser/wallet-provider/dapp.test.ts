import { test, assert } from '../../utils/assert'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { Wallet, DefaultProviderConfig } from '@0xsequence/provider'
import { sequenceContext, WalletContext } from '@0xsequence/network'
import { addressOf, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { testAccounts, getEOAWallet, deployWalletContext, testWalletContext, sendETH } from '../testutils'

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
  
  const wallet = new Wallet(providerConfig)

  // provider + signer, by default if a chainId is not specified it will direct
  // requests to the mainChain
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
    const chainId = wallet.getChainId()
    assert.equal(chainId, 31337, 'chainId is correct')
  })

  await test('getAccounts', async () => {
    const address = wallet.getAddress()
    assert.equal(address.toLowerCase(), '0x1abe642a25d9f3a725f07c622abd4356646c1820'.toLowerCase(), 'wallet address is correct')
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

    // we expect network order to be [mainChain, authChain, ..], so chain 31337 will be at index 0
    // hmm.. TODO: WalletProvider defaultNetwork should specify the "defaultNetwork", which will
    // become out *mainChain* ..
    const state1 = allWalletStates[0]
    assert.true(state1.chainId === 31337, 'state1, chainId is 31337')
    assert.true(state1.config.threshold === 1, 'state1, threshold')
    assert.true(state1.config.signers.length === 1, 'state1, 1 signer')
    assert.true(state1.address.toLowerCase() === wallet.getAddress().toLowerCase(), 'state1, address')
  })

  await test('getSigners', async () => {
    const signers = await signer.getSigners()
    assert.true(signers.length === 1, 'signers, single owner')
    assert.true(signers[0] === '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853', 'signers, check address')
  })

  await test('getBalance', async () => {
    // technically, the mock-wallet's single signer owner has some ETH..
    const balanceSigner1 = await provider.getBalance('0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853')
    assert.true(balanceSigner1.gt(ethers.BigNumber.from(0)), 'signer1 balance > 0')
  })

  await test('sendETH from the sequence smart wallet', async () => {
    // first, lets move some ETH into the wallet from a testnet seed account
    {
      const testAccount = getEOAWallet(testAccounts[0].privateKey)
      const walletBalanceBefore = await signer.getBalance()

      const ethAmount = ethers.utils.parseEther('10.1234')
      const txResp = await sendETH(testAccount, wallet.getAddress(), ethAmount)
      const txReceipt = await provider.getTransactionReceipt(txResp.hash)
      assert.true(txReceipt.status === 1, 'eth sent from signer1')

      const walletBalanceAfter = await signer.getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).eq(ethAmount), `wallet received ${ethAmount} eth`)
    }

    // sequence wallet to now send some eth back to another seed account
    // via the relayer
    {
      const walletAddress = wallet.getAddress()
      const walletBalanceBefore = await signer.getBalance()


      // send eth from sequence smart wallet to another test account
      const toAddress = testAccounts[1].address
      const toBalanceBefore = await provider.getBalance(toAddress)

      // TODO: failed txn with amount too high, etc.
      // TODO: send txn to invalid address

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

      const tx = {
        from: walletAddress,
        to: toAddress,
        value: ethAmount,
        // gasLimit: '0x555',
        // gasPrice: '0x555',
      }

      const txReceipt = await (await signer.sendTransaction(tx)).wait()

      assert.true(txReceipt.status === 1, 'txn sent successfully')
      assert.true(await signer.isDeployed(), 'wallet must be in deployed state after the txn')

      // transaction is sent to the deployed wallet, if the wallet is deployed.. otherwise its sent to guestModule
      if (beforeWalletDeployed) {
        assert.equal(txReceipt.to.toLowerCase(), wallet.getAddress().toLowerCase(), 'recipient is correct')
      } else {
        assert.equal(txReceipt.to.toLowerCase(), walletContext.guestModule.toLowerCase(), 'recipient is correct')
      }

      // Ensure fromAddress sent their eth
      const walletBalanceAfter = await signer.getBalance()
      assert.true(walletBalanceAfter.sub(walletBalanceBefore).mul(-1).eq(ethAmount), `wallet sent ${ethAmount} eth`)

      // Ensure toAddress received their eth
      const toBalanceAfter = await provider.getBalance(toAddress)
      assert.true(toBalanceAfter.sub(toBalanceBefore).eq(ethAmount), `toAddress received ${ethAmount} eth`)

    }
  })

  await test('signMessage on mainChain', async () => {
    const address = wallet.getAddress()
    const chainId = wallet.getChainId()

    const message = 'hihi'
    const message2 = ethers.utils.toUtf8Bytes('hihi')

    // Sign the message
    const sigs = await Promise.all([message, message2].map(async m => {
      // NOTE: is equivalent to signer.signMessage()
      // const sig = await wallet.commands.signMessage(m)
      const sig = await signer.signMessage(m)
      assert.equal(
        sig,
        '0x000100019ba7f3b76f70daa61fef6df01c0dfe6e271536b38808ae74bd8cf168e302ba6f1c997646ad59a775be1d434be81868119fe1b2d4a607f2c18ac8327a578067581c02',
        'signature match'
      )
      return sig
    }))
    const sig = sigs[0]

    // Verify the signature
    // TODO: if message is not Uint8Array, then lets run ethers.utils.toUtf8Bytes on it..
    // we can do this in our helper "commands".isValidSignature ..
    const messageDigest = ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message))) // ... remove toUtf8Bytes.. more versatile.. / easier to use..
    const isValid = await isValidSignature(address, messageDigest, sig, provider, deployedWalletContext, chainId)
    assert.true(isValid, 'signature is valid')

    // TODO:
    // now.....
    // wallet.commands.isValidSignature() .......
    // maybe helpers like isValidMessage() ..? maybe.. maybe not..
    // isValidTypedData() ?

    // TODO ... wallet.commands.verifyMessage() ... cleaner .. .. verifyTypedData .. etc..
    // we should also put these in utils package i think
    
    // Recover the address / config from the signature
    const subDigest = packMessageData(address, chainId, messageDigest)
    const walletConfig = await recoverConfig(subDigest, sig)

    // TODO: put walletContext on recoverConfig which will do addressOf automatically
    // it could also check against address in the signature.. to confirm..?
    // TODO: add utils / commands for easier recovery .... aka....... recoverAddress and recoverConfig .. add both..
    const recoveredWalletAddress = addressOf(walletConfig, testWalletContext)
    assert.true(recoveredWalletAddress.toLowerCase() === address.toLowerCase(), 'recover address')

    const singleSignerAddress = '0x4e37E14f5d5AAC4DF1151C6E8DF78B7541680853' // expected from mock-wallet owner
    assert.true(singleSignerAddress.toLowerCase() === walletConfig.signers[0].address.toLowerCase(), 'owner address check')
  })

  await test('signTypedData on mainChain', async () => {
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

    const domain = {
      name: 'Ether Mail',
      version: '1',
      chainId: await signer.getChainId(),
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const types = {
      'Person': [
        {name: "name", type: "string"},
        {name: "wallet", type: "address"}
      ]
    }

    const value = {
      'name': 'Bob',
      'wallet': '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    }

    const sig = await signer.signTypedData(domain, types, value)
    assert.equal(
      sig,
      '0x00010001529f138c329f03af22a2e85d087c604e3e7f1910c5bca6d5d2f45555e32d7193269c519ebe41c1ef677cbeaf0b226f7c540ae4f12842eaf6cfe3190ad4deff9b1b02',
      'signature match typed-data'
    )


  })

  await test('signAuthMessage', async () => {
    // by definition, signAuthMessage will always be directed at the authChain network
  })


  await test('chain ids', async () => {
    // chainId 31337
    {
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
    // TODO
  })
  
  //--------------

  // 1. signMessage, signTypedData, ... signAuthMessage
  // 2. getProvider for second chain, and lets get the chainId

  //--------------

  // <Button px={3} m={1} onClick={() => signMessage()}>Sign Message</Button>
  // <Button px={3} m={1} onClick={() => sign712()}>Sign TypedData</Button>
  // <Button px={3} m={1} onClick={() => signAuthMessage()}>Sign auth-chain message</Button>
  // <Button px={3} m={1} onClick={() => signETHAuth()}>Sign Authorization</Button>

  // sendETH ..
  // <Button px={3} m={1} onClick={() => sendTransactionForSidechain()}>Send sidechain transaction</Button>
  // <Button px={3} m={1} onClick={() => sendBatchTransaction()}>Send batch transaction</Button>
  // <Button px={3} m={1} onClick={() => sendARC()}>Contract, ARC: balanceOf</Button>
  
}


// TODO: test getting sequence signer, and getting the wallet config

// TODO: send batch transaction

// TODO: send coins

// TODO: send collectible

// TODO: setup all other tests from demo-dapp, just do it..

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

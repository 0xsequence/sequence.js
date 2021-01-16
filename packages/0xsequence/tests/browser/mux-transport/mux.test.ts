import { Web3Provider, ProxyMessageProvider, ProviderMessageTransport, ProviderMessage, WalletRequestHandler, ProxyMessageChannel, ProxyMessageHandler } from '@0xsequence/provider'
import { ethers, Wallet as EOAWallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { test, assert } from '../../utils/assert'
import { sequenceContext, testnetNetworks } from '@0xsequence/network'
import { Wallet, isValidSignature, packMessageData, recoverConfig } from '@0xsequence/wallet'
import { addressOf } from '@0xsequence/config'
import { LocalRelayer } from '@0xsequence/relayer'
import { testAccounts, getEOAWallet } from '../testutils'


export const tests = async () => {

  await test('a', async () => {
    assert.true(true)
  })

  // await test('verifying getAddress result', async () => {
  //   assert.equal(address.toLowerCase(), '0x24E78922FE5eCD765101276A422B8431d7151259'.toLowerCase(), 'wallet address')
  // })

}

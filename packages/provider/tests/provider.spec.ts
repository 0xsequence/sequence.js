import { ethers } from 'ethers'
import {
  ConnectOptions,
  OpenWalletIntent,
  OptionalChainId,
  SequenceClient,
  SequenceProvider,
  SingleNetworkSequenceProvider,
  WalletEventTypes
} from '../src'
import { expect } from 'chai'
import { ChainId, JsonRpcRequest, JsonRpcResponse, allNetworks } from '@0xsequence/network'
import { ExtendedTransactionRequest } from '../src/extended'

const hardhat1Provider = new ethers.JsonRpcProvider('http://127.0.0.1:9595', undefined, { cacheTimeout: -1 })
const hardhat2Provider = new ethers.JsonRpcProvider('http://127.0.0.1:8595', undefined, { cacheTimeout: -1 })

const providerFor = (chainId: number) => {
  if (chainId === 31337) {
    return hardhat1Provider
  }

  if (chainId === 31338) {
    return hardhat2Provider
  }

  throw new Error(`No provider for chainId ${chainId}`)
}

let defaultChainId: number

let callback: (chainId: number) => void

const onDefaultChainIdChanged = (cb: (chainId: number) => void) => {
  callback = cb
}

const setDefaultChainId = (chainId: number) => {
  defaultChainId = chainId
  callback(chainId)
}

const basicMockClient = {
  getChainId: () => defaultChainId,
  onDefaultChainIdChanged,
  setDefaultChainId,
  // EIP-1193
  onConnect: () => {},
  onDisconnect: () => {},
  onAccountsChanged: () => {}
} as unknown as SequenceClient

async function waitUntilNoFail(provider: ethers.Provider, timeout = 20000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await provider.getBlockNumber()
      return
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  console.warn('waitUntilNoFail timed out')
}

describe('SequenceProvider', () => {
  before(async () => {
    // Wait for both providers to be ready
    await Promise.all([waitUntilNoFail(hardhat1Provider), waitUntilNoFail(hardhat2Provider)])
  })

  beforeEach(() => {
    defaultChainId = 31337
  })

  describe('client proxy methods', () => {
    it('should call connect', async () => {
      let callsToConnect = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          connect: async (transport: ConnectOptions) => {
            expect(transport).to.deep.equal({ app: 'test' })
            callsToConnect++
            return { connected: true }
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = await provider.connect({ app: 'test' })
      expect(res).to.deep.equal({ connected: true })
      expect(callsToConnect).to.equal(1)
    })

    it('should call disconnect', async () => {
      let callsToDisconnect = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          disconnect: async () => {
            callsToDisconnect++
          }
        } as unknown as SequenceClient,
        providerFor
      )

      await provider.disconnect()
      expect(callsToDisconnect).to.equal(1)
    })

    it('should call isConnected', async () => {
      let callsToIsConnected = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          isConnected: () => {
            callsToIsConnected++
            return true
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = provider.isConnected()
      expect(res).to.equal(true)
      expect(callsToIsConnected).to.equal(1)
    })

    it('should call getSession', async () => {
      let callsToGetSession = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getSession: () => {
            callsToGetSession++
            return { session: 'test' }
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = provider.getSession()
      expect(res).to.deep.equal({ session: 'test' })
      expect(callsToGetSession).to.equal(1)
    })

    it('should call getAddress', async () => {
      let callsToGetAddress = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getAddress: () => {
            callsToGetAddress++
            return '0x123'
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = provider.getAddress()
      expect(res).to.equal('0x123')
      expect(callsToGetAddress).to.equal(1)
    })

    it('should call getNetworks', async () => {
      let callsToGetNetworks = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getNetworks: async () => {
            callsToGetNetworks++
            return [{ chainId: 31337 }, { chainId: 31338 }]
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = await provider.getNetworks()
      expect(res).to.deep.equal([{ chainId: 31337 }, { chainId: 31338 }])
      expect(callsToGetNetworks).to.equal(1)
    })

    it('should call getChainId', async () => {
      let callsToGetChainId = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getChainId: () => {
            callsToGetChainId++
            return 31337
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = provider.getChainId()
      expect(res).to.equal(31337)

      // This method is also called by the constructor
      expect(callsToGetChainId).to.equal(2)
    })

    it('should call setDefaultChainId', async () => {
      let callsToSetDefaultChainId = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          setDefaultChainId: (chainId: number) => {
            callsToSetDefaultChainId++
            expect(chainId).to.equal(31338)
          }
        } as unknown as SequenceClient,
        providerFor
      )

      provider.setDefaultChainId(31338)
      expect(callsToSetDefaultChainId).to.equal(1)
    })

    it('should call isOpened', async () => {
      let callsToIsOpened = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          isOpened: () => {
            callsToIsOpened++
            return true
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = provider.isOpened()
      expect(res).to.equal(true)
      expect(callsToIsOpened).to.equal(1)
    })

    it('should call closeWallet', async () => {
      let callsToCloseWallet = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          closeWallet: async () => {
            callsToCloseWallet++
          }
        } as unknown as SequenceClient,
        providerFor
      )

      provider.closeWallet()
      expect(callsToCloseWallet).to.equal(1)
    })

    it('should call getWalletContext', async () => {
      let callsToGetWalletContext = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getWalletContext: async () => {
            callsToGetWalletContext++
            return { walletContext: 'test' }
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = await provider.getWalletContext()
      expect(res).to.deep.equal({ walletContext: 'test' })
      expect(callsToGetWalletContext).to.equal(1)
    })

    it('should call getWalletConfig', async () => {
      let callsToGetWalletConfig = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          getOnchainWalletConfig: async (options?: OptionalChainId) => {
            expect(options).to.deep.equal({ chainId: 31338 })
            callsToGetWalletConfig++
            return { walletConfig: 'test' }
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = await provider.getWalletConfig('hardhat2')
      expect(res).to.deep.equal({ walletConfig: 'test' })
      expect(callsToGetWalletConfig).to.equal(1)
    })

    it('should call connect + authorize', async () => {
      let callsToConnect = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          connect: async (transport: ConnectOptions) => {
            expect(transport).to.deep.equal({ app: 'test', authorize: true })
            callsToConnect++
            return { connected: true }
          }
        } as unknown as SequenceClient,
        providerFor
      )

      const res = await provider.authorize({ app: 'test' })
      expect(res).to.deep.equal({ connected: true })
      expect(callsToConnect).to.equal(1)
    })

    it('should call openWallet', async () => {
      let callsToOpenWallet = 0

      const provider = new SequenceProvider(
        {
          ...basicMockClient,
          openWallet: (path: string, intent: OpenWalletIntent) => {
            expect(path).to.equal('/test')
            expect(intent).to.deep.equal({ type: 'connect' })
            callsToOpenWallet++
          }
        } as unknown as SequenceClient,
        providerFor
      )

      await provider.openWallet('/test', { type: 'connect' })
      expect(callsToOpenWallet).to.equal(1)
    })
  })

  describe('provider events', () => {
    let provider: SequenceProvider

    const callbacks: { [event in keyof WalletEventTypes]: (data: any) => any } = {} as any

    beforeEach(() => {
      const registerCallback = <K extends keyof WalletEventTypes>(name: K, cb: WalletEventTypes[K]) => {
        callbacks[name] = cb
        return () => {}
      }

      // When SequenceProvider is instantiated it will register callbacks on the client which emit events
      // We capture these callbacks and call them manually to simulate the events
      provider = new SequenceProvider(
        {
          ...basicMockClient,
          onConnect: (cb: WalletEventTypes['connect']) => registerCallback('connect', cb),
          onDisconnect: (cb: WalletEventTypes['disconnect']) => registerCallback('disconnect', cb),
          onDefaultChainIdChanged: (cb: WalletEventTypes['chainChanged']) => registerCallback('chainChanged', cb),
          onAccountsChanged: (cb: WalletEventTypes['accountsChanged']) => registerCallback('accountsChanged', cb)
        } as unknown as SequenceClient,
        providerFor
      )
    })

    it('should call onConnect', async () => {
      let callsToOnConnect = 0

      provider.on('connect', (data: any) => {
        callsToOnConnect++
        expect(data).to.deep.equal({
          connected: true,
          chainId: '0x112233'
        })
      })

      callbacks['connect']({
        connected: true,
        chainId: '0x112233'
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(callsToOnConnect).to.equal(1)
    })

    it('should call onDisconnect', async () => {
      let callsToOnDisconnect = 0

      provider.on('disconnect', (data: any) => {
        callsToOnDisconnect++
        expect(data).to.deep.equal({
          connected: false,
          error: 1000
        })
      })

      callbacks['disconnect']({
        connected: false,
        error: 1000
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(callsToOnDisconnect).to.equal(1)
    })

    it('should call onDefaultChainIdChanged', async () => {
      let callsToOnDefaultChainIdChanged = 0

      provider.on('chainChanged', (data: any) => {
        callsToOnDefaultChainIdChanged++
        expect(data).to.equal(31338)
      })

      callbacks['chainChanged'](31338)

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(callsToOnDefaultChainIdChanged).to.equal(1)
    })

    it('should call onAccountsChanged', async () => {
      let callsToOnAccountsChanged = 0

      provider.on('accountsChanged', (data: any) => {
        callsToOnAccountsChanged++
        expect(data).to.deep.equal(['0x123'])
      })

      callbacks['accountsChanged'](['0x123'])

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(callsToOnAccountsChanged).to.equal(1)
    })
  })

  // This converts from "any kind" of chainId to a number
  describe('toChainId', () => {
    let provider: SequenceProvider

    const defaultChainId: number = 31337

    beforeEach(() => {
      provider = new SequenceProvider(
        {
          ...basicMockClient,
          onDefaultChainIdChanged,
          getChainId: () => defaultChainId
        } as unknown as SequenceClient,
        providerFor
      )
    })

    it('should work for numbers', () => {
      expect(provider.toChainId(1)).to.equal(1)
      expect(provider.toChainId(31337)).to.equal(31337)
      expect(provider.toChainId(31338)).to.equal(31338)
    })

    it('should fail if network is not supported', () => {
      expect(() => provider.toChainId(99999)).to.throw('Unsupported network 99999')
    })

    it('should work for number strings', () => {
      expect(provider.toChainId('1')).to.equal(1)
      expect(provider.toChainId('31337')).to.equal(31337)
      expect(provider.toChainId('31338')).to.equal(31338)
    })

    it('should work for hex strings', () => {
      expect(provider.toChainId('0x1')).to.equal(1)
      expect(provider.toChainId('0x7a69')).to.equal(31337)
      expect(provider.toChainId('0x7a6a')).to.equal(31338)
    })

    it('should fail if network is not supported - number string', () => {
      expect(() => provider.toChainId('99999')).to.throw('Unsupported network 99999')
    })

    it('should fail if network is not supported - hex string', () => {
      expect(() => provider.toChainId('0x99999')).to.throw('Unsupported network 0x99999')
    })

    it('should work for network names', () => {
      expect(provider.toChainId('mainnet')).to.equal(1)
      expect(provider.toChainId('rinkeby')).to.equal(4)
      expect(provider.toChainId('goerli')).to.equal(5)
      expect(provider.toChainId('polygon')).to.equal(137)
      expect(provider.toChainId('mumbai')).to.equal(80001)
      expect(provider.toChainId('polygon-zkevm')).to.equal(1101)
      expect(provider.toChainId('bsc')).to.equal(56)
      expect(provider.toChainId('bsc-testnet')).to.equal(97)
      expect(provider.toChainId('optimism')).to.equal(10)
      expect(provider.toChainId('arbitrum')).to.equal(42161)
      expect(provider.toChainId('arbitrum-sepolia')).to.equal(421614)
      expect(provider.toChainId('arbitrum-nova')).to.equal(42170)
      expect(provider.toChainId('avalanche')).to.equal(43114)
    })

    it('should fail if network is not supported - network name', () => {
      expect(() => provider.toChainId('notreallyachain')).to.throw('Unsupported network notreallyachain')
    })

    it('should work when passing a full network config', () => {
      expect(provider.toChainId(allNetworks.find(n => n.chainId === 1))).to.equal(1)
      expect(provider.toChainId(allNetworks.find(n => n.chainId === 31337))).to.equal(31337)
    })

    it('should fail if the passed network config doesnt exist on the provider', () => {
      const fakeNetwork = {
        chainId: 99999,
        name: 'fake',
        rpcUrl: 'http://127.0.0.1:99999',
        nativeToken: { symbol: 'ETH', name: 'Ether', decimals: 18 }
      }
      expect(() => provider.toChainId(fakeNetwork)).to.throw(`Unsupported network ${fakeNetwork}`)
    })

    it('should work when passing a BigInt', () => {
      expect(provider.toChainId(1n)).to.equal(1)
      expect(provider.toChainId(31337n)).to.equal(31337)
      expect(provider.toChainId(31338n)).to.equal(31338)
    })

    it('should fail if network is not supported - BigInt', () => {
      expect(() => provider.toChainId(99999n)).to.throw('Unsupported network 99999')
    })

    it('should return undefined if passed undefined', () => {
      expect(provider.toChainId(undefined)).to.equal(undefined)
    })
  })

  describe('getProvider (single network)', () => {
    let provider: SequenceProvider

    beforeEach(() => {
      provider = new SequenceProvider(basicMockClient, providerFor)
    })

    it('should return self if asked for no specific chain', () => {
      expect(provider.getProvider()).to.equal(provider)
    })

    it('should not return self if asked for the current default chain', () => {
      expect(provider.getProvider(provider.getChainId())).to.not.equal(provider)
    })

    it('should return specific provider if asked for a specific chain', () => {
      expect(provider.getProvider(31337).getChainId()).to.equal(31337)
      expect(provider.getProvider(31338).getChainId()).to.equal(31338)
    })

    it('specific provider should not be parent provider', () => {
      expect(provider.getProvider(31337)).to.not.equal(provider)
    })

    it('should return same provider if asked for specific chain twice', () => {
      const provider1 = provider.getProvider(31337)
      const provider2 = provider.getProvider(31337)
      expect(provider1).to.equal(provider2)

      const provider3 = provider.getProvider(31338)
      const provider4 = provider.getProvider(31338)
      expect(provider3).to.equal(provider4)

      expect(provider1).to.not.equal(provider3)
    })

    it('should fail to return provider for different chain from a specific provider', () => {
      const provider1 = provider.getProvider(31337)
      expect(() => provider1.getProvider(31338)).to.throw(
        'This provider only supports the network 31337, but 31338 was requested.'
      )

      const provider2 = provider.getProvider(31338)
      expect(() => provider2.getProvider(31337)).to.throw(
        'This provider only supports the network 31338, but 31337 was requested.'
      )
    })

    it('specific provider should return self if asked for no specific chain', () => {
      const provider1 = provider.getProvider(31337)
      expect(provider1.getProvider()).to.equal(provider1)
      expect(provider1).to.not.equal(provider)
      expect(provider1.getProvider()).to.not.equal(provider)
    })

    it('specific provider should return self if asked for the provider of its own chain', () => {
      const provider1 = provider.getProvider(31338)
      expect(provider1.getProvider(31338)).to.equal(provider1)
    })

    it('should return isSingleNetworkSequenceProvider', async () => {
      const main = provider.getProvider()
      const single = provider.getProvider(31337)

      expect(SequenceProvider.is(main)).to.equal(true)
      expect(SequenceProvider.is(single)).to.equal(true)
      expect(SingleNetworkSequenceProvider.is(main)).to.equal(false)
      expect(SingleNetworkSequenceProvider.is(single)).to.equal(true)
    })
  })

  describe('getSigner (single network)', () => {
    let provider: SequenceProvider

    beforeEach(() => {
      provider = new SequenceProvider(basicMockClient, providerFor)
    })

    it('should get signer for default chain', async () => {
      const signer = provider.getSigner()
      expect(await signer.getChainId()).to.equal(31337)
    })

    it('should not get same signer for default and specific chain', async () => {
      const signer1 = provider.getSigner()
      const signer2 = provider.getSigner(31337)
      expect(signer1).to.not.equal(signer2)
    })

    it('should get signer for specific chain', async () => {
      const signer = provider.getSigner(31338)
      expect(await signer.getChainId()).to.equal(31338)
    })

    it('should get signer for specific chain from specific provider', async () => {
      const signer = provider.getProvider(31338).getSigner()
      expect(await signer.getChainId()).to.equal(31338)
    })

    it('should get signer for specific chain from specific provider (using chainid(', async () => {
      const signer = provider.getProvider(31338).getSigner(31338)
      expect(await signer.getChainId()).to.equal(31338)
    })

    it('should fail to get signer for different chain from a specific provider', async () => {
      expect(() => provider.getProvider(31338).getSigner(31337)).to.throw(
        'This provider only supports the network 31338, but 31337 was requested.'
      )
    })
  })

  describe('subproviders (public rpc methods)', () => {
    let provider: SequenceProvider

    beforeEach(() => {
      provider = new SequenceProvider(basicMockClient, providerFor)
    })

    it('should return hardhat1 subprovider for chain 31337', async () => {
      expect(await provider._getSubprovider('hardhat')).to.equal(hardhat1Provider)
    })

    it('should return hardhat2 subprovider for chain 31338', async () => {
      expect(await provider._getSubprovider('hardhat2')).to.equal(hardhat2Provider)
    })

    it('should fail to return subprovider if providerFor doesnt return a provider', async () => {
      await expect(provider._getSubprovider(1)).to.be.rejectedWith('No provider for chainId 1')
    })

    it('should return hardhat1 subprovider for default chain', async () => {
      expect(await provider._getSubprovider()).to.equal(hardhat1Provider)
    })

    it('should return hardat2 if default chain is changed', async () => {
      provider.setDefaultChainId(31338)
      expect(await provider._getSubprovider()).to.equal(hardhat2Provider)
    })

    describe('forward methods to subprovider', () => {
      const testAccounts = [
        new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat1Provider),
        new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat2Provider)
      ]

      describe('forward getBlockNumber', () => {
        let bn1: number
        let bn2: number

        beforeEach(async () => {
          bn1 = await hardhat1Provider.getBlockNumber()
          bn2 = await hardhat2Provider.getBlockNumber()

          if (bn1 === bn2) {
            await hardhat2Provider.send('evm_mine', [])

            bn2 = await hardhat2Provider.getBlockNumber()
          }

          expect(bn1).to.not.equal(bn2)
        })

        it('forward getBlockNumber - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlockNumber()).to.equal(bn1, 'default chain')

          provider.setDefaultChainId(31338)
          expect(await provider.getBlockNumber()).to.equal(bn2, 'new default chain')
        })

        it('forward getBlockNumber - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlockNumber({ chainId: 31337 })).to.equal(bn1)
          expect(await provider.getBlockNumber({ chainId: 31338 })).to.equal(bn2)
        })

        it('forward getBlockNumber - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getBlockNumber()).to.equal(bn1)
          expect(await provider.getProvider('hardhat2').getBlockNumber()).to.equal(bn2)
        })

        it('fail to forward getBlockNumber - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getBlockNumber({ chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward getFeeData', () => {
        let provider: SequenceProvider

        beforeEach(() => {
          // NOTICE: We need to path the hardhat providers so they return different gas prices
          provider = new SequenceProvider(basicMockClient, (chainId: number) => {
            if (chainId === 31337) {
              return {
                ...hardhat1Provider,
                getFeeData: async () => ({ gasPrice: 1n })
              } as unknown as ethers.JsonRpcProvider
            }

            if (chainId === 31338) {
              return {
                ...hardhat2Provider,
                getFeeData: async () => ({ gasPrice: 2n })
              } as unknown as ethers.JsonRpcProvider
            }

            throw new Error(`No provider for chainId ${chainId}`)
          })
        })

        it('forward getFeeData - default', async () => {
          expect((await provider.getFeeData()).gasPrice).to.equal(1n)

          provider.setDefaultChainId(31338)
          expect((await provider.getFeeData()).gasPrice).to.equal(2n)
        })

        it('forward getFeeData - specific chain', async () => {
          expect((await provider.getFeeData({ chainId: 31337 })).gasPrice).to.equal(1n)
          expect((await provider.getFeeData({ chainId: 31338 })).gasPrice).to.equal(2n)
        })

        it('forward getFeeData - static network provider', async () => {
          expect((await provider.getProvider('hardhat').getFeeData()).gasPrice).to.equal(1n)
          expect((await provider.getProvider(31338).getFeeData()).gasPrice).to.equal(2n)
        })

        it('fail to forward getFeeData - static network provider for different chain', async () => {
          await expect(provider.getProvider('hardhat').getFeeData({ chainId: 31338 })).to.be.rejectedWith(
            'This provider only supports the network 31337, but 31338 was requested.'
          )
        })
      })

      describe('forward getBalance', () => {
        let b1: bigint
        let b2: bigint

        beforeEach(async () => {
          b1 = await hardhat1Provider.getBalance(testAccounts[0].address)
          b2 = await hardhat2Provider.getBalance(testAccounts[1].address)

          if (b1 === b2) {
            await testAccounts[1].sendTransaction({
              to: ethers.Wallet.createRandom().address,
              value: 1
            })

            b2 = await hardhat2Provider.getBalance(testAccounts[1].address)
          }

          expect(b1).to.not.equal(b2)
        })

        it('forward getBalance - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBalance(testAccounts[0].address)).to.equal(b1)

          provider.setDefaultChainId(31338)
          expect(await provider.getBalance(testAccounts[1].address)).to.equal(b2)
        })

        it('forward getBalance - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBalance(testAccounts[0].address, undefined, { chainId: 31337 })).to.equal(b1)
          expect(await provider.getBalance(testAccounts[1].address, undefined, { chainId: 31338 })).to.equal(b2)
        })

        it('forward getBalance - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getBalance(testAccounts[0].address)).to.equal(b1)
          expect(await provider.getProvider('hardhat2').getBalance(testAccounts[1].address)).to.equal(b2)
        })

        it('fail to forward getBalance - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(
            provider.getProvider('hardhat2').getBalance(testAccounts[0].address, undefined, { chainId: 31337 })
          ).to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getTransactionCount', () => {
        let txc1: number
        let txc2: number

        beforeEach(async () => {
          txc1 = await hardhat1Provider.getTransactionCount(testAccounts[0].address)
          txc2 = await hardhat2Provider.getTransactionCount(testAccounts[1].address)

          if (txc1 === txc2) {
            await testAccounts[1].sendTransaction({
              to: testAccounts[0].address
            })

            txc2 = await hardhat2Provider.getTransactionCount(testAccounts[1].address)
          }

          expect(txc1).to.not.equal(txc2)
        })

        it('forward getTransactionCount - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransactionCount(testAccounts[0].address)).to.equal(txc1)

          provider.setDefaultChainId(31338)
          expect(await provider.getTransactionCount(testAccounts[1].address)).to.equal(txc2)
        })

        it('forward getTransactionCount - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransactionCount(testAccounts[0].address, undefined, { chainId: 31337 })).to.equal(txc1)
          expect(await provider.getTransactionCount(testAccounts[1].address, undefined, { chainId: 31338 })).to.equal(txc2)
        })

        it('forward getTransactionCount - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getTransactionCount(testAccounts[0].address)).to.equal(txc1)
          expect(await provider.getProvider('hardhat2').getTransactionCount(testAccounts[1].address)).to.equal(txc2)
        })

        it('fail to forward getTransactionCount - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(
            provider.getProvider('hardhat2').getTransactionCount(testAccounts[0].address, undefined, { chainId: 31337 })
          ).to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getCode', () => {
        let addr: string

        beforeEach(async () => {
          // deploy a "contract" with code 0x112233
          const res = await testAccounts[0]
            .sendTransaction({
              data: '0x621122336000526003601df3'
            })
            .then(r => r.wait())

          if (!res?.contractAddress) {
            throw new Error('Could not get transaction receipt')
          }

          addr = res.contractAddress

          expect(await hardhat1Provider.getCode(addr)).to.equal('0x112233')
          expect(await hardhat2Provider.getCode(addr)).to.equal('0x')
        })

        it('forward getCode - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getCode(addr)).to.equal('0x112233')

          provider.setDefaultChainId(31338)
          expect(await provider.getCode(addr)).to.equal('0x')
        })

        it('forward getCode - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getCode(addr, undefined, { chainId: 31337 })).to.equal('0x112233')
          expect(await provider.getCode(addr, undefined, { chainId: 31338 })).to.equal('0x')
        })

        it('forward getCode - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getCode(addr)).to.equal('0x112233')
          expect(await provider.getProvider('hardhat2').getCode(addr)).to.equal('0x')
        })

        it('fail to forward getCode - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getCode(addr, undefined, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward getStorage', () => {
        const expected = '0x0000000000000000000000000000000000000000000000000000000000112233'
        const empty = '0x0000000000000000000000000000000000000000000000000000000000000000'

        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that writes 0x112233 to storage slot 0x445566
          const res = await testAccounts[0]
            .sendTransaction({
              data: '0x621122336244556655'
            })
            .then(r => r.wait())

          if (!res?.contractAddress) {
            throw new Error('Could not get transaction receipt')
          }

          addr = res.contractAddress

          expect(await hardhat1Provider.getStorage(addr, '0x445566')).to.equal(expected)
          expect(await hardhat2Provider.getStorage(addr, '0x445566')).to.equal(empty)
        })

        it('forward getStorage - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getStorage(addr, '0x445566')).to.equal(expected)

          provider.setDefaultChainId(31338)
          expect(await provider.getStorage(addr, '0x445566')).to.equal(empty)
        })

        it('forward getStorage - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getStorage(addr, '0x445566', undefined, { chainId: 31337 })).to.equal(expected)
          expect(await provider.getStorage(addr, '0x445566', undefined, { chainId: 31338 })).to.equal(empty)
        })

        it('forward getStorage - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getStorage(addr, '0x445566')).to.equal(expected)
          expect(await provider.getProvider('hardhat2').getStorage(addr, '0x445566')).to.equal(empty)
        })

        it('fail to forward getStorage - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(
            provider.getProvider('hardhat2').getStorage(addr, '0x445566', undefined, { chainId: 31337 })
          ).to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward call', () => {
        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that when called returns 0x112233
          const res = await testAccounts[0]
            .sendTransaction({
              data: '0x6b621122336000526003601df3600052600c6014f3'
            })
            .then(r => r.wait())

          if (!res?.contractAddress) {
            throw new Error('Could not get transaction receipt')
          }

          addr = res.contractAddress

          expect(await hardhat1Provider.call({ to: addr })).to.equal('0x112233')
          expect(await hardhat2Provider.call({ to: addr })).to.equal('0x')
        })

        it('forward call - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.call({ to: addr })).to.equal('0x112233')

          provider.setDefaultChainId(31338)
          expect(await provider.call({ to: addr })).to.equal('0x')
        })

        it('forward call - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.call({ to: addr }, { chainId: 31337 })).to.equal('0x112233')
          expect(await provider.call({ to: addr }, { chainId: 31338 })).to.equal('0x')
        })

        it('forward call - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').call({ to: addr })).to.equal('0x112233')
          expect(await provider.getProvider('hardhat2').call({ to: addr })).to.equal('0x')
        })

        it('fail to forward call - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').call({ to: addr }, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward estimateGas', () => {
        let eg1: bigint
        let eg2: bigint

        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that when called returns 0x112233
          // (this uses a bit of gas that we can measure)
          const res = await testAccounts[0]
            .sendTransaction({
              data: '0x6b621122336000526003601df3600052600c6014f3'
            })
            .then(r => r.wait())

          if (!res?.contractAddress) {
            throw new Error('Could not get transaction receipt')
          }

          addr = res.contractAddress

          eg1 = await hardhat1Provider.estimateGas({ to: addr })
          eg2 = await hardhat2Provider.estimateGas({ to: addr })

          expect(eg1).to.not.equal(eg2)
        })

        it('forward estimateGas - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.estimateGas({ to: addr })).to.equal(eg1)

          provider.setDefaultChainId(31338)
          expect(await provider.estimateGas({ to: addr })).to.equal(eg2)
        })

        it('forward estimateGas - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.estimateGas({ to: addr }, { chainId: 31337 })).to.equal(eg1)
          expect(await provider.estimateGas({ to: addr }, { chainId: 31338 })).to.equal(eg2)
        })

        it('forward estimateGas - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').estimateGas({ to: addr })).to.equal(eg1)
          expect(await provider.getProvider('hardhat2').estimateGas({ to: addr })).to.equal(eg2)
        })

        it('fail to forward estimateGas - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').estimateGas({ to: addr }, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward getBlock', () => {
        let b1: ethers.Block | null
        let b2: ethers.Block | null

        beforeEach(async () => {
          b1 = await hardhat1Provider.getBlock(1)
          b2 = await hardhat2Provider.getBlock(1)

          expect(b1).to.not.deep.equal(b2)
        })

        it('forward getBlock - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlock(1)).to.deep.equal(b1)

          provider.setDefaultChainId(31338)
          expect(await provider.getBlock(1)).to.deep.equal(b2)
        })

        it('forward getBlock - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlock(1, undefined, { chainId: 31337 })).to.deep.equal(b1)
          expect(await provider.getBlock(1, undefined, { chainId: 31338 })).to.deep.equal(b2)
        })

        it('forward getBlock - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getBlock(1)).to.deep.equal(b1)
          expect(await provider.getProvider('hardhat2').getBlock(1)).to.deep.equal(b2)
        })

        it('fail to forward getBlock - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getBlock(0, undefined, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward getTransaction', () => {
        let t1: string

        beforeEach(async () => {
          // We can't create a transaction that exists on both chains
          const res = await testAccounts[0].sendTransaction({
            to: ethers.Wallet.createRandom().address
          })

          t1 = res.hash
          await res.wait()
        })

        it('forward getTransaction - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransaction(t1).then(r => r?.hash)).to.equal(t1)

          provider.setDefaultChainId(31338)
          expect(await provider.getTransaction(t1)).to.be.null
        })

        it('forward getTransaction - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransaction(t1, { chainId: 31337 }).then(r => r?.hash)).to.equal(t1)
          expect(await provider.getTransaction(t1, { chainId: 31338 })).to.be.null
        })

        it('forward getTransaction - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(
            await provider
              .getProvider('hardhat')
              .getTransaction(t1)
              .then(r => r?.hash)
          ).to.equal(t1)
          expect(await provider.getProvider('hardhat2').getTransaction(t1)).to.be.null
        })

        it('fail to forward getTransaction - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getTransaction(t1, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward getLogs', () => {
        let t1: string

        let r1: Array<ethers.Log>
        let r2: Array<ethers.Log>

        beforeEach(async () => {
          // Deploy a contract that emits a single LOG0 event (during deployment)
          const res = await testAccounts[0]
            .sendTransaction({
              data: '0x60006000a0'
            })
            .then(r => r.wait())

          if (!res?.contractAddress) {
            throw new Error('Could not get transaction receipt')
          }

          t1 = res.contractAddress

          r1 = await hardhat1Provider.getLogs({ address: t1 })
          r2 = await hardhat2Provider.getLogs({ address: t1 })

          expect(r1).to.not.deep.equal(r2)
        })

        it('forward getLogs - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getLogs({ address: t1 })).to.deep.equal(r1)

          provider.setDefaultChainId(31338)
          expect(await provider.getLogs({ address: t1 })).to.deep.equal(r2)
        })

        it('forward getLogs - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getLogs({ address: t1 }, { chainId: 31337 })).to.deep.equal(r1)
          expect(await provider.getLogs({ address: t1 }, { chainId: 31338 })).to.deep.equal(r2)
        })

        it('forward getLogs - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getLogs({ address: t1 })).to.deep.equal(r1)
          expect(await provider.getProvider('hardhat2').getLogs({ address: t1 })).to.deep.equal(r2)
        })

        it('fail to forward getLogs - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getLogs({ address: t1 }, { chainId: 31337 })).to.be.rejectedWith(
            'This provider only supports the network 31338, but 31337 was requested.'
          )
        })
      })

      describe('forward waitForTransaction', () => {
        let t1: string

        beforeEach(async () => {
          t1 = await testAccounts[0]
            .sendTransaction({
              to: ethers.Wallet.createRandom().address
            })
            .then(r => r!.hash)
        })

        it('forward waitForTransaction - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.waitForTransaction(t1, undefined, 250).then(r => r?.hash)).to.equal(t1)

          provider.setDefaultChainId(31338)
          await expect(provider.waitForTransaction(t1, undefined, 250)).to.be.rejected
        })

        it('forward waitForTransaction - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.waitForTransaction(t1, undefined, 250, { chainId: 31337 }).then(r => r?.hash)).to.equal(t1)
          await expect(provider.waitForTransaction(t1, undefined, 250, { chainId: 31338 })).to.be.rejected
        })

        it('forward waitForTransaction - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(
            await provider
              .getProvider('hardhat')
              .waitForTransaction(t1, undefined, 250)
              .then(r => r?.hash)
          ).to.equal(t1)
          await expect(provider.getProvider('hardhat2').waitForTransaction(t1, undefined, 250)).to.be.rejected
        })

        it('fail to forward waitForTransaction - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(
            provider.getProvider('hardhat2').waitForTransaction(t1, undefined, 250, { chainId: 31337 })
          ).to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      // NOTICE: These tests may be a bit fragile, as they rely
      // on using the sequence mainnet provider
      describe('forward ENS methods', () => {
        let provider: SequenceProvider
        let mainnetProvider: ethers.JsonRpcProvider

        let vitalikAddr: string | null

        before(async () => {
          mainnetProvider = new ethers.JsonRpcProvider('https://nodes.sequence.app/mainnet')
          vitalikAddr = await mainnetProvider.resolveName('vitalik.eth')
        })

        beforeEach(() => {
          provider = new SequenceProvider(
            {
              ...basicMockClient,
              getNetworks: async () => allNetworks
            } as unknown as SequenceClient,
            (chainId: number) => {
              if (chainId === 1) {
                return mainnetProvider
              }

              return providerFor(chainId)
            }
          )
        })

        it('resolve normal address', async () => {
          const addr = ethers.Wallet.createRandom().address
          expect(await provider.resolveName(addr)).to.equal(addr)
        })

        it('forward resolveName on primary provider', async () => {
          expect(await provider.resolveName('vitalik.eth')).to.equal(vitalikAddr)
        })

        it('forward resolveName on single network (mainnet) provider', async () => {
          expect(await provider.getProvider('mainnet').resolveName('vitalik.eth')).to.equal(vitalikAddr)
        })

        it('fail to forward resolveName on single network (hardhat) provider', async () => {
          await expect(provider.getProvider('hardhat').resolveName('vitalik.eth')).to.be.rejectedWith(
            'This provider only supports the network 31337, but 1 was requested.'
          )
        })
      })
    })

    describe('perform implementation', () => {
      describe('perform eth_chainId', async () => {
        it('should return initial default chainId', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))
        })

        it('should return new default chainId', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          provider.setDefaultChainId(31338)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should return static chainId', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider(31337).perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))
          expect(await provider.getProvider(31338).perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should return chainId using request', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.request({ method: 'eth_chainId' })).to.equal(ethers.toQuantity(31337))
        })
      })

      describe('perform eth_accounts', async () => {
        let provider: SequenceProvider
        let address: string

        beforeEach(async () => {
          address = ethers.Wallet.createRandom().address
          provider = new SequenceProvider(
            {
              ...basicMockClient,
              getAddress: () => address
            } as unknown as SequenceClient,
            providerFor
          )
        })

        it('should return accounts on main provider', async () => {
          expect(await provider.perform('eth_accounts', [])).to.deep.equal([address])
        })

        it('should return accounts on single network provider', async () => {
          expect(await provider.getProvider(31337).perform('eth_accounts', [])).to.deep.equal([address])
          expect(await provider.getProvider(31338).perform('eth_accounts', [])).to.deep.equal([address])
        })

        it('should return accounts using request', async () => {
          expect(await provider.request({ method: 'eth_accounts' })).to.deep.equal([address])
        })
      })

      describe('perform wallet_switchEthereumChain', async () => {
        it('should switch default chainId using request', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.request({ method: 'eth_chainId' })).to.equal(ethers.toQuantity(31337))

          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a6a' }] })
          expect(defaultChainId).to.equal(31338)
        })

        it('should switch default chainId using object', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

          await provider.perform('wallet_switchEthereumChain', [{ chainId: '0x7a6a' }])
          expect(defaultChainId).to.equal(31338)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should switch default chainId using hex string', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

          await provider.perform('wallet_switchEthereumChain', ['0x7a6a'])
          expect(defaultChainId).to.equal(31338)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should switch default chainId using number', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

          await provider.perform('wallet_switchEthereumChain', [31338])
          expect(defaultChainId).to.equal(31338)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should switch default chainId using string', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

          await provider.perform('wallet_switchEthereumChain', ['31338'])
          expect(defaultChainId).to.equal(31338)
          expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
        })

        it('should fail to switch default chainId on static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider(31337).perform('wallet_switchEthereumChain', ['31337'])).to.be.rejectedWith(
            'This provider only supports the network 31337; use the parent provider to switch networks.'
          )
        })

        describe('using the setDefaultChainId method', async () => {
          it('should switch default chainId using name', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

            provider.setDefaultChainId('hardhat2')
            expect(defaultChainId).to.equal(31338)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
          })

          it('should switch default chainId using number', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

            provider.setDefaultChainId(31338)
            expect(defaultChainId).to.equal(31338)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
          })

          it('should switch default chainId using string', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

            provider.setDefaultChainId('31338')
            expect(defaultChainId).to.equal(31338)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
          })

          it('should switch default chainId using hex string', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31337))

            provider.setDefaultChainId('0x7a6a')
            expect(defaultChainId).to.equal(31338)
            expect(await provider.perform('eth_chainId', [])).to.equal(ethers.toQuantity(31338))
          })

          it('should fail to switch default chainId on static network provider', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(() => provider.getProvider(31337).setDefaultChainId(31338)).to.throw(
              'This provider only supports the network 31337; use the parent provider to switch networks.'
            )
          })

          it('should fail to switch default chainId (to same chainId) on static network provider', async () => {
            const provider = new SequenceProvider(basicMockClient, providerFor)
            expect(() => provider.getProvider(31337).setDefaultChainId(31337)).to.throw(
              'This provider only supports the network 31337; use the parent provider to switch networks.'
            )
          })
        })
      })

      describe('sequence client methods', () => {
        describe('perform eth_sendTransaction', async () => {
          const expectedResult = ethers.hexlify(ethers.randomBytes(32))

          let provider: SequenceProvider
          let calledCount: number

          let expectedChainId: number
          let expectedTx: ethers.TransactionRequest

          beforeEach(async () => {
            calledCount = 0
            provider = new SequenceProvider(
              {
                ...basicMockClient,
                request(request: JsonRpcRequest): Promise<any> {
                  expect(request.chainId).to.equal(expectedChainId)
                  expect(request.method).to.equal('eth_sendTransaction')
                  expect(request.params).to.deep.equal([expectedTx])
                  calledCount++
                  return Promise.resolve(expectedResult)
                }
              } as unknown as SequenceClient,
              providerFor
            )

            expectedTx = {
              to: ethers.Wallet.createRandom().address,
              value: '9000',
              data: ethers.hexlify(ethers.randomBytes(66))
            }
          })

          it('should call sendTransaction on main provider', async () => {
            expectedChainId = 31337
            const res = await provider.perform('eth_sendTransaction', [expectedTx])
            expect(calledCount).to.equal(1)
            expect(res).to.equal(expectedResult)
          })

          it('should call sendTransaction after switching default chainId', async () => {
            expectedChainId = 31338
            provider.setDefaultChainId(31338)
            const res = await provider.perform('eth_sendTransaction', [expectedTx])
            expect(calledCount).to.equal(1)
            expect(res).to.equal(expectedResult)
          })

          it('should call sendTransaction on single network provider', async () => {
            expectedChainId = 31338
            const res = await provider.getProvider(31338).perform('eth_sendTransaction', [expectedTx])
            expect(calledCount).to.equal(1)
            expect(res).to.equal(expectedResult)
          })

          it('should call sendTransaction with aux data', async () => {
            expectedTx = {
              ...expectedTx,
              auxiliary: [{ to: ethers.Wallet.createRandom().address }]
            } as ExtendedTransactionRequest
            expectedChainId = 31338
            const res = await provider.getProvider(31338).perform('eth_sendTransaction', [expectedTx])
            expect(calledCount).to.equal(1)
            expect(res).to.equal(expectedResult)
          })

          it('should call sendTransaction using request', async () => {
            expectedChainId = 31337
            const res = await provider.request({ method: 'eth_sendTransaction', params: [expectedTx] })
            expect(calledCount).to.equal(1)
            expect(res).to.equal(expectedResult)
          })
        })
        ;['eth_sign', 'personal_sign', 'sequence_sign'].forEach(method => {
          describe(`perform ${method}`, async () => {
            const expectedResult = ethers.hexlify(ethers.randomBytes(120))

            let provider: SequenceProvider
            let calledCount: number

            let expectedChainId: number
            let expectedAddress: string
            let expectedMessage: string

            beforeEach(async () => {
              calledCount = 0
              provider = new SequenceProvider(
                {
                  ...basicMockClient,
                  request(request: JsonRpcRequest): Promise<any> {
                    expect(request.chainId).to.equal(expectedChainId)
                    expect(request.method).to.equal(method)
                    expect(request.params).to.deep.equal([expectedAddress, expectedMessage])
                    calledCount++
                    return Promise.resolve(expectedResult)
                  }
                } as unknown as SequenceClient,
                providerFor
              )

              expectedAddress = ethers.Wallet.createRandom().address
              expectedMessage = ethers.hexlify(ethers.randomBytes(66))
            })

            it('should call sign on main provider', async () => {
              expectedChainId = 31337
              const res = await provider.perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign after switching default chainId', async () => {
              expectedChainId = 31338
              provider.setDefaultChainId(31338)
              const res = await provider.perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign on single network provider', async () => {
              expectedChainId = 31338
              const res = await provider.getProvider(31338).perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign using request', async () => {
              expectedChainId = 31337
              const res = await provider.request({ method, params: [expectedAddress, expectedMessage] })
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })
          })
        })
        ;['eth_signTypedData', 'eth_signTypedData_v4', 'sequence_signTypedData_v4'].forEach(method => {
          describe(`perform ${method}`, async () => {
            const expectedResult = ethers.hexlify(ethers.randomBytes(121))

            let provider: SequenceProvider
            let calledCount: number

            let expectedChainId: number
            let expectedAddress: string
            let expectedMessage: Array<any>

            beforeEach(async () => {
              calledCount = 0
              provider = new SequenceProvider(
                {
                  ...basicMockClient,
                  request(request: JsonRpcRequest): Promise<any> {
                    expect(request.chainId).to.equal(expectedChainId)
                    expect(request.method).to.equal(method)
                    expect(request.params).to.deep.equal([expectedAddress, expectedMessage])
                    calledCount++
                    return Promise.resolve(expectedResult)
                  }
                } as unknown as SequenceClient,
                providerFor
              )

              expectedAddress = ethers.Wallet.createRandom().address
              expectedMessage = [{ thisisjustdata: ethers.hexlify(ethers.randomBytes(66)), sure: 'yes' }]
            })

            it('should call sign on main provider', async () => {
              expectedChainId = 31337
              const res = await provider.perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign after switching default chainId', async () => {
              expectedChainId = 31338
              provider.setDefaultChainId(31338)
              const res = await provider.perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign on single network provider', async () => {
              expectedChainId = 31338
              const res = await provider.getProvider(31338).perform(method, [expectedAddress, expectedMessage])
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })

            it('should call sign using request', async () => {
              expectedChainId = 31337
              const res = await provider.request({ method, params: [expectedAddress, expectedMessage] })
              expect(calledCount).to.equal(1)
              expect(res).to.equal(expectedResult)
            })
          })
        })
      })

      describe('misc public rpc methods', () => {
        let provider: SequenceProvider
        let b1: number
        let b2: number

        beforeEach(async () => {
          provider = new SequenceProvider(basicMockClient, providerFor)
          b1 = await hardhat1Provider.getBlockNumber()
          b2 = await hardhat2Provider.getBlockNumber()
        })

        it('should forward random method to main provider', async () => {
          await provider.perform('evm_mine', [])
          expect(await hardhat1Provider.getBlockNumber()).to.equal(b1 + 1)
          expect(await hardhat2Provider.getBlockNumber()).to.equal(b2)
        })

        it('should forward random method after switching default chain', async () => {
          provider.setDefaultChainId(31338)
          await provider.perform('evm_mine', [])
          expect(await hardhat1Provider.getBlockNumber()).to.equal(b1)
          expect(await hardhat2Provider.getBlockNumber()).to.equal(b2 + 1)
        })

        it('should forward random method to single network provider', async () => {
          await provider.getProvider(31338).perform('evm_mine', [])
          expect(await hardhat1Provider.getBlockNumber()).to.equal(b1)
          expect(await hardhat2Provider.getBlockNumber()).to.equal(b2 + 1)
        })

        it('should forward method with parameters', async () => {
          await provider.perform('evm_mine', [])
          await provider.perform('evm_mine', [])
          const block1 = await hardhat1Provider.getBlock(2).then(t => t?.hash)
          expect(await provider.perform('eth_getBlockByNumber', ['0x2', false]).then(t => t.hash)).to.equal(block1)
        })

        it('should forward method using request', async () => {
          await provider.request({ method: 'evm_mine', params: [] })
          await provider.request({ method: 'evm_mine', params: [] })
          const block1 = await hardhat1Provider.getBlock(2).then(t => t?.hash)
          expect(await provider.request({ method: 'eth_getBlockByNumber', params: ['0x2', false] }).then(t => t.hash)).to.equal(
            block1
          )
        })
      })
    })
  })

  it('should return true to isSequenceProvider', () => {
    const provider = new SequenceProvider(basicMockClient, providerFor)
    expect(SequenceProvider.is(provider)).to.equal(true)
  })

  describe('network switching', () => {
    it('should emit chainChanged when default chain is changed', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)

      let emittedCount = 0
      provider.on('chainChanged', chainId => {
        expect(chainId).to.equal(31338)
        emittedCount++
      })

      provider.setDefaultChainId(31338)

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(emittedCount).to.equal(1)
    })

    it('should detect network', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const initialNetwork = await provider.detectNetwork()

      expect(initialNetwork.chainId).to.equal(31337n, 'initial network')

      provider.setDefaultChainId(31338)

      await new Promise(resolve => setTimeout(resolve, 100))
      const newNetwork = await provider.detectNetwork()
      expect(newNetwork.chainId).to.equal(31338n, '2nd network')
    })

    it('should update polling block number', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)

      const b1 = await hardhat1Provider.getBlockNumber()
      const b2 = await hardhat2Provider.getBlockNumber()

      if (b1 === b2) {
        await hardhat2Provider.send('evm_mine', [])
      }

      expect(b1).to.not.equal(b2)

      await new Promise(resolve => setTimeout(resolve, 250))
      const initialBlockNumber = await provider.getBlockNumber()

      provider.setDefaultChainId(31338)

      await new Promise(resolve => setTimeout(resolve, 250))
      const newBlockNumber = await provider.getBlockNumber()

      expect(initialBlockNumber).to.not.equal(newBlockNumber)
    })
  })
})

import { ethers } from "ethers"
import { ConnectOptions, OpenWalletIntent, OptionalChainId, SequenceClient, SequenceProvider, SingleNetworkSequenceProvider } from "../src"
import { expect } from "chai"
import { allNetworks } from "@0xsequence/network"

const hardhat1Provider = new ethers.providers.JsonRpcProvider('http://localhost:9595', 31337)
const hardhat2Provider = new ethers.providers.JsonRpcProvider('http://localhost:8595', 31338)

const providerFor = (chainId: number) => {
  if (chainId === 31337) {
    return hardhat1Provider
  }

  if (chainId === 31338) {
    return hardhat2Provider
  }

  throw new Error(`No provider for chainId ${chainId}`)
}

let defaultChainId: number = 31337

let callback: (chainId: number) => void

let onDefaultChainIdChanged = (cb: (chainId: number) => void) => {
  callback = cb
}

let setDefaultChainId = (chainId: number) => {
  defaultChainId = chainId
  callback(chainId)
}

const basicMockClient = {
  getChainId: () => defaultChainId,
  onDefaultChainIdChanged,
} as unknown as SequenceClient

describe('SequenceProvider', () => {
  before(async () => {
    // Wait for both providers to be ready
    await Promise.all([
      hardhat1Provider.ready,
      hardhat2Provider.ready
    ])
  })

  describe('client proxy methods', () => {
    it('should call connect', async () => {
      let callsToConnect = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        connect: async (transport: ConnectOptions) => {
          expect(transport).to.deep.equal({ app: 'test' })
          callsToConnect++
          return { connected: true }
        }
      } as unknown as SequenceClient, providerFor)

      const res = await provider.connect({ app: 'test' })
      expect(res).to.deep.equal({ connected: true })
      expect(callsToConnect).to.equal(1)
    })

    it('should call disconnect', async () => {
      let callsToDisconnect = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        disconnect: async () => {
          callsToDisconnect++
        }
      } as unknown as SequenceClient, providerFor)

      await provider.disconnect()
      expect(callsToDisconnect).to.equal(1)
    })

    it('should call isConnected', async () => {
      let callsToIsConnected = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        isConnected: () => {
          callsToIsConnected++
          return true
        }
      } as unknown as SequenceClient, providerFor)

      const res = provider.isConnected()
      expect(res).to.equal(true)
      expect(callsToIsConnected).to.equal(1)
    })

    it('should call getSession', async () => {
      let callsToGetSession = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getSession: () => {
          callsToGetSession++
          return { session: 'test' }
        }
      } as unknown as SequenceClient, providerFor)

      const res = provider.getSession()
      expect(res).to.deep.equal({ session: 'test' })
      expect(callsToGetSession).to.equal(1)
    })

    it('should call getAddress', async () => {
      let callsToGetAddress = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getAddress: () => {
          callsToGetAddress++
          return '0x123'
        }
      } as unknown as SequenceClient, providerFor)

      const res = provider.getAddress()
      expect(res).to.equal('0x123')
      expect(callsToGetAddress).to.equal(1)
    })

    it('should call getNetworks', async () => {
      let callsToGetNetworks = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getNetworks: async () => {
          callsToGetNetworks++
          return [{ chainId: 31337 }, { chainId: 31338 }]
        }
      } as unknown as SequenceClient, providerFor)

      const res = await provider.getNetworks()
      expect(res).to.deep.equal([{ chainId: 31337 }, { chainId: 31338 }])
      expect(callsToGetNetworks).to.equal(1)
    })

    it('should call getChainId', async () => {
      let callsToGetChainId = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getChainId: () => {
          callsToGetChainId++
          return 31337
        }
      } as unknown as SequenceClient, providerFor)

      const res = provider.getChainId()
      expect(res).to.equal(31337)

      // This method is also called by the constructor
      expect(callsToGetChainId).to.equal(2)
    })

    it('should call setDefaultChainId', async () => {
      let callsToSetDefaultChainId = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        setDefaultChainId: (chainId: number) => {
          callsToSetDefaultChainId++
          expect(chainId).to.equal(31338)
        }
      } as unknown as SequenceClient, providerFor)

      provider.setDefaultChainId(31338)
      expect(callsToSetDefaultChainId).to.equal(1)
    })

    it('should call isOpened', async () => {
      let callsToIsOpened = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        isOpened: () => {
          callsToIsOpened++
          return true
        }
      } as unknown as SequenceClient, providerFor)

      const res = provider.isOpened()
      expect(res).to.equal(true)
      expect(callsToIsOpened).to.equal(1)
    })

    it('should call closeWallet', async () => {
      let callsToCloseWallet = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        closeWallet: async () => {
          callsToCloseWallet++
        }
      } as unknown as SequenceClient, providerFor)

      provider.closeWallet()
      expect(callsToCloseWallet).to.equal(1)
    })

    it('should call getWalletContext', async () => {
      let callsToGetWalletContext = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getWalletContext: async () => {
          callsToGetWalletContext++
          return { walletContext: 'test' }
        }
      } as unknown as SequenceClient, providerFor)

      const res = await provider.getWalletContext()
      expect(res).to.deep.equal({ walletContext: 'test' })
      expect(callsToGetWalletContext).to.equal(1)
    })

    it('should call getWalletConfig', async () => {
      let callsToGetWalletConfig = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        getOnchainWalletConfig: async (options?: OptionalChainId) => {
          expect(options).to.deep.equal({ chainId: 31338 })
          callsToGetWalletConfig++
          return { walletConfig: 'test' }
        }
      } as unknown as SequenceClient, providerFor)

      const res = await provider.getWalletConfig('hardhat2')
      expect(res).to.deep.equal({ walletConfig: 'test' })
      expect(callsToGetWalletConfig).to.equal(1) 
    })

    it('should call connect + authorize', async () => {
      let callsToConnect = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        connect: async (transport: ConnectOptions) => {
          expect(transport).to.deep.equal({ app: 'test', authorize: true })
          callsToConnect++
          return { connected: true }
        }
      } as unknown as SequenceClient, providerFor)

      const res = await provider.authorize({ app: 'test' })
      expect(res).to.deep.equal({ connected: true })
      expect(callsToConnect).to.equal(1)
    })

    it('should call openWallet', async () => {
      let callsToOpenWallet = 0

      const provider = new SequenceProvider({
        ...basicMockClient,
        openWallet: (path: string, intent: OpenWalletIntent) => {
          expect(path).to.equal('/test')
          expect(intent).to.deep.equal({ type: 'connect' })
          callsToOpenWallet++
        }
      } as unknown as SequenceClient, providerFor)

      await provider.openWallet('/test', { type: 'connect' })
      expect(callsToOpenWallet).to.equal(1)
    })
  })

  // This converts from "any kind" of chainId to a number
  describe('toChainId', () => {
    let provider: SequenceProvider

    let defaultChainId: number = 31337

    beforeEach(() => {
      provider = new SequenceProvider({
        onDefaultChainIdChanged,
        getChainId: () => defaultChainId
      } as unknown as SequenceClient, providerFor)
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
      expect(provider.toChainId('arbitrum-goerli')).to.equal(421613)
      expect(provider.toChainId('arbitrum-nova')).to.equal(42170)
      expect(provider.toChainId('avalanche')).to.equal(43114)
    })

    it('should fail if network is not supported - network name', () => {
      expect(() => provider.toChainId('notreallyachain')).to.throw('Unsupported network notreallyachain')
    })

    it('should work when passing a full network config', () => {
      expect(provider.toChainId(allNetworks.find((n) => n.chainId === 1))).to.equal(1)
      expect(provider.toChainId(allNetworks.find((n) => n.chainId === 31337))).to.equal(31337)
    })

    it('should fail if the passed network config doesnt exist on the provider', () => {
      const fakeNetwork = { chainId: 99999, name: 'fake', rpcUrl: 'http://localhost:99999' }
      expect(() => provider.toChainId(fakeNetwork)).to.throw(`Unsupported network ${fakeNetwork}`)
    })

    it('should work when passing a BigNumber', () => {
      expect(provider.toChainId(ethers.BigNumber.from(1))).to.equal(1)
      expect(provider.toChainId(ethers.BigNumber.from(31337))).to.equal(31337)
      expect(provider.toChainId(ethers.BigNumber.from(31338))).to.equal(31338)
    })

    it('should fail if network is not supported - BigNumber', () => {
      expect(() => provider.toChainId(ethers.BigNumber.from(99999))).to.throw(`Unsupported network ${ethers.BigNumber.from(99999)}`)
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
      expect(() => provider1.getProvider(31338))
        .to.throw('This provider only supports the network 31337, but 31338 was requested.')

      const provider2 = provider.getProvider(31338)
      expect(() => provider2.getProvider(31337))
        .to.throw('This provider only supports the network 31338, but 31337 was requested.')
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
      expect(() => provider.getProvider(31338).getSigner(31337))
        .to.throw('This provider only supports the network 31338, but 31337 was requested.')
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
      setDefaultChainId(31338)
      expect(await provider._getSubprovider()).to.equal(hardhat2Provider)
    })

    describe('forward methods to subprovider', () => {
      const testAccounts = [
        new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat1Provider),
        new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat2Provider)
      ]

      beforeEach(() => {
        defaultChainId = 31337
      })

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

          setDefaultChainId(31338)
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
          await expect(provider.getProvider('hardhat2').getBlockNumber({ chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getGasPrice', () => {
        let provider: SequenceProvider

        beforeEach(() => {
          // NOTICE: We need to path the hardhat providers so they return different gas prices
          provider = new SequenceProvider(basicMockClient, (chainId: number) => {
            if (chainId === 31337) {
              return {
                ...hardhat1Provider,
                getGasPrice: async () => ethers.BigNumber.from(1)
              } as unknown as ethers.providers.JsonRpcProvider
            }
        
            if (chainId === 31338) {
              return {
                ...hardhat2Provider,
                getGasPrice: async () => ethers.BigNumber.from(2)
              } as unknown as ethers.providers.JsonRpcProvider
            }
        
            throw new Error(`No provider for chainId ${chainId}`)
          })
        })

        it('forward getGasPrice - default', async () => {
          expect(await provider.getGasPrice()).to.deep.equal(ethers.BigNumber.from(1))
  
          setDefaultChainId(31338)
          expect(await provider.getGasPrice()).to.deep.equal(ethers.BigNumber.from(2))
        })

        it('forward getGasPrice - specific chain', async () => {
          expect(await provider.getGasPrice({ chainId: 31337 })).to.deep.equal(ethers.BigNumber.from(1))
          expect(await provider.getGasPrice({ chainId: 31338 })).to.deep.equal(ethers.BigNumber.from(2))
        })

        it('forward getGasPrice - static network provider', async () => {
          expect(await provider.getProvider('hardhat').getGasPrice()).to.deep.equal(ethers.BigNumber.from(1))
          expect(await provider.getProvider(31338).getGasPrice()).to.deep.equal(ethers.BigNumber.from(2))
        })

        it('fail to forward getGasPrice - static network provider for different chain', async () => {
          await expect(provider.getProvider('hardhat').getGasPrice({ chainId: 31338 }))
            .to.be.rejectedWith('This provider only supports the network 31337, but 31338 was requested.')
        })
      })

      describe('forward getBalance', () => {
        let b1: ethers.BigNumber
        let b2: ethers.BigNumber

        beforeEach(async () => {
          b1 = await hardhat1Provider.getBalance(testAccounts[0].address)
          b2 = await hardhat2Provider.getBalance(testAccounts[1].address)

          if (b1.eq(b2)) {
            await testAccounts[1].sendTransaction({
              to: ethers.Wallet.createRandom().address,
              value: 1
            })

            b2 = await hardhat2Provider.getBalance(testAccounts[1].address)
          }

          expect(b1).to.not.deep.equal(b2)
        })

        it('forward getBalance - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBalance(testAccounts[0].address)).to.deep.equal(b1)

          setDefaultChainId(31338)
          expect(await provider.getBalance(testAccounts[1].address)).to.deep.equal(b2)
        })

        it('forward getBalance - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBalance(testAccounts[0].address, undefined, { chainId: 31337 })).to.deep.equal(b1)
          expect(await provider.getBalance(testAccounts[1].address, undefined, { chainId: 31338 })).to.deep.equal(b2)
        })

        it('forward getBalance - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getBalance(testAccounts[0].address)).to.deep.equal(b1)
          expect(await provider.getProvider('hardhat2').getBalance(testAccounts[1].address)).to.deep.equal(b2)
        })

        it('fail to forward getBalance - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getBalance(testAccounts[0].address, undefined, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
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
              to: testAccounts[0].address,
            })

            txc2 = await hardhat2Provider.getTransactionCount(testAccounts[1].address)
          }

          expect(txc1).to.not.equal(txc2)
        })

        it('forward getTransactionCount - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransactionCount(testAccounts[0].address)).to.equal(txc1)

          setDefaultChainId(31338)
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
          await expect(provider.getProvider('hardhat2').getTransactionCount(testAccounts[0].address, undefined, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getCode', () => {
        let addr: string

        beforeEach(async () => {
          // deploy a "contract" with code 0x112233
          const res = await testAccounts[0].sendTransaction({
            data: '0x621122336000526003601df3'
          }).then((r) => r.wait())

          addr = res.contractAddress

          expect(await hardhat1Provider.getCode(addr)).to.equal('0x112233')
          expect(await hardhat2Provider.getCode(addr)).to.equal('0x')
        })

        it('forward getCode - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getCode(addr)).to.equal('0x112233')

          setDefaultChainId(31338)
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
          await expect(provider.getProvider('hardhat2').getCode(addr, undefined, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getStorageAt', () => {
        const expected = '0x0000000000000000000000000000000000000000000000000000000000112233'
        const empty    = '0x0000000000000000000000000000000000000000000000000000000000000000'

        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that writes 0x112233 to storage slot 0x445566
          const res = await testAccounts[0].sendTransaction({
            data: '0x621122336244556655'
          }).then((r) => r.wait())

          addr = res.contractAddress

          expect(await hardhat1Provider.getStorageAt(addr, '0x445566')).to.equal(expected)
          expect(await hardhat2Provider.getStorageAt(addr, '0x445566')).to.equal(empty)
        })

        it('forward getStorageAt - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getStorageAt(addr, '0x445566')).to.equal(expected)

          setDefaultChainId(31338)
          expect(await provider.getStorageAt(addr, '0x445566')).to.equal(empty)
        })

        it('forward getStorageAt - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getStorageAt(addr, '0x445566', undefined, { chainId: 31337 })).to.equal(expected)
          expect(await provider.getStorageAt(addr, '0x445566', undefined, { chainId: 31338 })).to.equal(empty)
        })

        it('forward getStorageAt - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getStorageAt(addr, '0x445566')).to.equal(expected)
          expect(await provider.getProvider('hardhat2').getStorageAt(addr, '0x445566')).to.equal(empty)
        })

        it('fail to forward getStorageAt - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getStorageAt(addr, '0x445566', undefined, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward call', () => {
        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that when called returns 0x112233
          const res = await testAccounts[0].sendTransaction({
            data: '0x6b621122336000526003601df3600052600c6014f3'
          }).then((r) => r.wait())

          addr = res.contractAddress

          expect(await hardhat1Provider.call({ to: addr })).to.equal('0x112233')
          expect(await hardhat2Provider.call({ to: addr })).to.equal('0x')
        })

        it('forward call - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.call({ to: addr })).to.equal('0x112233')

          setDefaultChainId(31338)
          expect(await provider.call({ to: addr })).to.equal('0x')
        })

        it('forward call - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.call({ to: addr }, undefined, { chainId: 31337 })).to.equal('0x112233')
          expect(await provider.call({ to: addr }, undefined, { chainId: 31338 })).to.equal('0x')
        })

        it('forward call - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').call({ to: addr })).to.equal('0x112233')
          expect(await provider.getProvider('hardhat2').call({ to: addr })).to.equal('0x')
        })

        it('fail to forward call - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').call({ to: addr }, undefined, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward estimateGas', () => {
        let eg1: ethers.BigNumber
        let eg2: ethers.BigNumber

        let addr: string

        beforeEach(async () => {
          // deploy a "contract" that when called returns 0x112233
          // (this uses a bit of gas that we can measure)
          const res = await testAccounts[0].sendTransaction({
            data: '0x6b621122336000526003601df3600052600c6014f3'
          }).then((r) => r.wait())

          addr = res.contractAddress

          eg1 = await hardhat1Provider.estimateGas({ to: addr })
          eg2 = await hardhat2Provider.estimateGas({ to: addr })

          expect(eg1).to.not.deep.equal(eg2)
        })

        it('forward estimateGas - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.estimateGas({ to: addr })).to.deep.equal(eg1)

          setDefaultChainId(31338)
          expect(await provider.estimateGas({ to: addr })).to.deep.equal(eg2)
        })

        it('forward estimateGas - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.estimateGas({ to: addr }, { chainId: 31337 })).to.deep.equal(eg1)
          expect(await provider.estimateGas({ to: addr }, { chainId: 31338 })).to.deep.equal(eg2)
        })

        it('forward estimateGas - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').estimateGas({ to: addr })).to.deep.equal(eg1)
          expect(await provider.getProvider('hardhat2').estimateGas({ to: addr })).to.deep.equal(eg2)
        })

        it('fail to forward estimateGas - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').estimateGas({ to: addr }, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getBlock', () => {
        let b1: ethers.providers.Block
        let b2: ethers.providers.Block

        beforeEach(async () => {
          b1 = await hardhat1Provider.getBlock(1)
          b2 = await hardhat2Provider.getBlock(1)

          expect(b1).to.not.deep.equal(b2)
        })

        it('forward getBlock - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlock(1)).to.deep.equal(b1)

          setDefaultChainId(31338)
          expect(await provider.getBlock(1)).to.deep.equal(b2)
        })

        it('forward getBlock - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getBlock(1, { chainId: 31337 })).to.deep.equal(b1)
          expect(await provider.getBlock(1, { chainId: 31338 })).to.deep.equal(b2)
        })

        it('forward getBlock - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getBlock(1)).to.deep.equal(b1)
          expect(await provider.getProvider('hardhat2').getBlock(1)).to.deep.equal(b2)
        })

        it('fail to forward getBlock - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getBlock(0, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getTransaction', () => {
        let t1: string

        beforeEach(async () => {
          // We can't create a transaction that exists on both chains
          const res = await testAccounts[0].sendTransaction({
            to: ethers.Wallet.createRandom().address,
          })

          t1 = res.hash
          await res.wait()
        })

        it('forward getTransaction - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransaction(t1).then(r => r.hash)).to.equal(t1)

          setDefaultChainId(31338)
          expect(await provider.getTransaction(t1)).to.be.null
        })

        it('forward getTransaction - specific chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getTransaction(t1, { chainId: 31337 }).then(r => r.hash)).to.equal(t1)
          expect(await provider.getTransaction(t1, { chainId: 31338 })).to.be.null
        })

        it('forward getTransaction - static network provider', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getProvider('hardhat').getTransaction(t1).then(r => r.hash)).to.equal(t1)
          expect(await provider.getProvider('hardhat2').getTransaction(t1)).to.be.null
        })

        it('fail to forward getTransaction - static network provider for different chain', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          await expect(provider.getProvider('hardhat2').getTransaction(t1, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      describe('forward getLogs', () => {
        let t1: string

        let r1: Array<ethers.providers.Log>
        let r2: Array<ethers.providers.Log>

        beforeEach(async () => {
          // Deploy a contract that emits a single LOG0 event (during deployment)
          const res = await testAccounts[0].sendTransaction({
            data: '0x60006000a0'
          }).then((r) => r.wait())

          t1 = res.contractAddress

          r1 = await hardhat1Provider.getLogs({ address: t1 })
          r2 = await hardhat2Provider.getLogs({ address: t1 })

          expect(r1).to.not.deep.equal(r2)
        })

        it('forward getLogs - default', async () => {
          const provider = new SequenceProvider(basicMockClient, providerFor)
          expect(await provider.getLogs({ address: t1 })).to.deep.equal(r1)

          setDefaultChainId(31338)
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
          await expect(provider.getProvider('hardhat2').getLogs({ address: t1 }, { chainId: 31337 }))
            .to.be.rejectedWith('This provider only supports the network 31338, but 31337 was requested.')
        })
      })

      // NOTICE: These tests may be a bit fragile, as they rely
      // on using the sequence mainnet provider
      describe('forward ENS methods', () => {
        let provider: SequenceProvider
        let mainnetProvider: ethers.providers.JsonRpcProvider

        let vitalikAddr: string | null

        before(async () => {
          mainnetProvider = new ethers.providers.JsonRpcProvider('https://nodes.sequence.app/mainnet')
          vitalikAddr = await mainnetProvider.resolveName('vitalik.eth')
        })

        beforeEach(() => {
          provider = new SequenceProvider(
            {
              ...basicMockClient,
              getNetworks: async () => (allNetworks)
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
          await expect(provider.getProvider('hardhat').resolveName('vitalik.eth'))
            .to.be.rejectedWith('This provider only supports the network 31337, but 1 was requested.')
        })
      })
    })
  })

  it('should return true to isSequenceProvider', () => {
    const provider = new SequenceProvider(basicMockClient, providerFor)
    expect(SequenceProvider.is(provider)).to.equal(true)
  })

  describe('network switching', () => {
    beforeEach(async () => {
      defaultChainId = 31337
    })

    it('should emit chainChanged when default chain is changed', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)

      let emittedCount = 0
      provider.on('chainChanged', (chainId) => {
        expect(chainId).to.equal(31338)
        emittedCount++
      })

      setDefaultChainId(31338)

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(emittedCount).to.equal(1)
    })

    it('should detect network', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const initialNetwork = await provider.detectNetwork()

      expect(initialNetwork.chainId).to.equal(31337, "initial network")

      setDefaultChainId(31338)

      await new Promise((resolve) => setTimeout(resolve, 100))
      const newNetwork = await provider.detectNetwork()
      expect(newNetwork.chainId).to.equal(31338, "2nd network")
    })

    it('should update polling block number', async () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)

      const b1 = await hardhat1Provider.getBlockNumber()
      const b2 = await hardhat2Provider.getBlockNumber()

      if (b1 === b2) {
        await hardhat2Provider.send('evm_mine', [])
      }

      expect(b1).to.not.equal(b2)

      await new Promise((resolve) => setTimeout(resolve, 250))
      const initialBlockNumber = provider.blockNumber

      setDefaultChainId(31338)

      await new Promise((resolve) => setTimeout(resolve, 250))
      const newBlockNumber = await provider.getBlockNumber()

      expect(initialBlockNumber).to.not.equal(newBlockNumber)
    })
  })
})

import { ethers } from 'ethers'
import {
  ConnectOptions,
  OpenWalletIntent,
  OptionalChainId,
  OptionalChainIdLike,
  OptionalEIP6492,
  SequenceClient,
  SequenceProvider,
  SequenceSigner,
  SingleNetworkSequenceProvider,
  SingleNetworkSequenceSigner
} from '../src'
import { expect } from 'chai'
import { JsonRpcRequest, JsonRpcResponse, allNetworks } from '@0xsequence/network'
import { TypedData, parseEther } from '@0xsequence/utils'

const hardhat1Provider = new ethers.JsonRpcProvider('http://127.0.0.1:9595')
const hardhat2Provider = new ethers.JsonRpcProvider('http://127.0.0.1:8595')

const testAccounts = [
  new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat1Provider),
  new ethers.Wallet('0xcd0434442164a4a6ef9bb677da8dc326fddf412cad4df65e1a3f2555aee5e2b3').connect(hardhat2Provider)
]

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

describe('SequenceSigner', () => {
  before(async () => {
    // Wait for both providers to be ready
    await Promise.all([waitUntilNoFail(hardhat1Provider), waitUntilNoFail(hardhat2Provider)])
  })

  beforeEach(() => {
    defaultChainId = 31337
  })

  describe('client proxy methods', () => {
    describe('getWalletConfig', () => {
      const returnWalletConfig = {
        version: 1,
        threshold: 5,
        signers: [
          {
            weight: 1,
            addr: ethers.Wallet.createRandom().address
          }
        ]
      }

      let expectedChainId: number
      let signer: SequenceSigner
      let callsToGetWalletConfig: number

      beforeEach(() => {
        callsToGetWalletConfig = 0
        signer = new SequenceProvider(
          {
            ...basicMockClient,
            getOnchainWalletConfig: async (args: { chainId: number }) => {
              expect(args.chainId).to.equal(expectedChainId)
              callsToGetWalletConfig++
              return returnWalletConfig
            }
          } as unknown as SequenceClient,
          providerFor
        ).getSigner()
      })

      it('should return the wallet config', async () => {
        expectedChainId = 31337
        const walletConfig = await signer.getWalletConfig()
        expect(walletConfig).to.deep.equal(returnWalletConfig)
        expect(callsToGetWalletConfig).to.equal(1)
      })

      it('should return the wallet config for a different chainId', async () => {
        expectedChainId = 31338
        signer.provider.setDefaultChainId(31338)
        const walletConfig = await signer.getWalletConfig()
        expect(walletConfig).to.deep.equal(returnWalletConfig)
        expect(callsToGetWalletConfig).to.equal(1)
      })

      it('should return the wallet config on a specific network signer', async () => {
        const signer1 = signer.getSigner(31337)
        const signer2 = signer.getSigner(31338)

        expectedChainId = 31337
        const walletConfig1 = await signer1.getWalletConfig()
        expect(walletConfig1).to.deep.equal(returnWalletConfig)
        expect(callsToGetWalletConfig).to.equal(1)

        expectedChainId = 31338
        const walletConfig2 = await signer2.getWalletConfig()
        expect(walletConfig2).to.deep.equal(returnWalletConfig)
        expect(callsToGetWalletConfig).to.equal(2)
      })
    })

    it('getNetworks', async () => {
      let callsToGetNetworks = 0
      const signer = new SequenceProvider(
        {
          ...basicMockClient,
          getNetworks: async () => {
            callsToGetNetworks++
            return allNetworks
          }
        } as unknown as SequenceClient,
        providerFor
      ).getSigner()

      expect(await signer.getNetworks()).to.deep.equal(allNetworks)
      expect(callsToGetNetworks).to.equal(1)

      expect(await signer.getSigner(31337).getNetworks()).to.deep.equal(allNetworks)
      expect(callsToGetNetworks).to.equal(2)

      expect(await signer.getSigner('hardhat2').getNetworks()).to.deep.equal(allNetworks)
      expect(callsToGetNetworks).to.equal(3)
    })

    describe('getChainId', () => {
      it('should return the default chainId', async () => {
        const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
        expect(await signer.getChainId()).to.equal(31337)
      })

      it('should return the chainId for a specific signer', async () => {
        const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
        expect(await signer.getSigner(31338).getChainId()).to.equal(31338)
      })

      it('should return the chainId for a specific signer by name', async () => {
        const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
        expect(await signer.getSigner('hardhat2').getChainId()).to.equal(31338)
      })

      it('should return the chainId after the default chainId changes', async () => {
        const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
        expect(await signer.getChainId()).to.equal(31337)
        signer.provider.setDefaultChainId(31338)
        expect(await signer.getChainId()).to.equal(31338)
      })
    })

    describe('getAddress', () => {
      let callsToGetAddress: number
      let signer: SequenceSigner
      let address: string

      beforeEach(() => {
        callsToGetAddress = 0
        address = ethers.Wallet.createRandom().address
        signer = new SequenceProvider(
          {
            ...basicMockClient,
            getAddress: () => {
              callsToGetAddress++
              return address
            }
          } as unknown as SequenceClient,
          providerFor
        ).getSigner()
      })

      it('should return the address', async () => {
        expect(await signer.getAddress()).to.equal(address)
        expect(callsToGetAddress).to.equal(1)
      })

      it('should return the address for a specific signer', async () => {
        expect(await signer.getSigner(31338).getAddress()).to.equal(address)
        expect(callsToGetAddress).to.equal(1)
      })

      it('getAddress should not be memoized', async () => {
        expect(await signer.getAddress()).to.equal(address)
        expect(callsToGetAddress).to.equal(1)
        expect(await signer.getAddress()).to.equal(address)
        expect(callsToGetAddress).to.equal(2)
      })
    })
  })

  describe('provider proxy methods', () => {
    describe('getBalance', () => {
      let signer: SequenceSigner
      let address: string

      beforeEach(async () => {
        address = ethers.Wallet.createRandom().address

        signer = new SequenceProvider(
          {
            ...basicMockClient,
            getAddress: () => address
          } as unknown as SequenceClient,
          providerFor
        ).getSigner()

        // Send 10 wei in hardhat1 and 20 wei in hardhat2
        await testAccounts[0]
          .sendTransaction({
            to: address,
            value: 10
          })
          .then(tx => tx.wait())

        await testAccounts[1]
          .sendTransaction({
            to: address,
            value: 20
          })
          .then(tx => tx.wait())
      })

      it('should return the balance on default chain', async () => {
        expect(await signer.getBalance()).to.equal(10n)
      })

      it('should return the balance on default chain after switching networks', async () => {
        signer.provider.setDefaultChainId(31338)
        expect(await signer.getBalance()).to.equal(20n)
      })

      it('should return the balance on specific chain', async () => {
        expect(await signer.getBalance(undefined, { chainId: 31337 })).to.equal(10n)
        expect(await signer.getBalance(undefined, { chainId: 31338 })).to.equal(20n)
      })

      it('should return the balance on specific chain using string network name', async () => {
        expect(await signer.getBalance(undefined, { chainId: 'hardhat' })).to.equal(10n)
        expect(await signer.getBalance(undefined, { chainId: 'hardhat2' })).to.equal(20n)
      })

      it('should return the balance on static network signer', async () => {
        expect(await signer.getSigner(31337).getBalance()).to.equal(10n)
        expect(await signer.getSigner(31338).getBalance()).to.equal(20n)
      })

      it('should return the balance on static network signer using string network name', async () => {
        expect(await signer.getSigner('hardhat').getBalance()).to.equal(10n)
        expect(await signer.getSigner('hardhat2').getBalance()).to.equal(20n)
      })

      it('should return balance on specific chain when passing chainId', async () => {
        expect(await signer.getSigner('hardhat').getBalance(undefined, { chainId: 31337 })).to.equal(10n)
        expect(await signer.getSigner('hardhat2').getBalance(undefined, { chainId: 31338 })).to.equal(20n)
      })

      it('should fail to return balance on specific chain when passing different chainId', async () => {
        await expect(signer.getSigner('hardhat').getBalance(undefined, { chainId: 31338 })).to.be.rejectedWith(
          'This signer only supports the network 31337, but 31338 was requested.'
        )
      })
    })

    describe('estimate gas', () => {
      let signer: SequenceSigner

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

        signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      })

      it('forward estimateGas - default', async () => {
        expect(await signer.estimateGas({ to: addr })).to.equal(eg1)

        signer.provider.setDefaultChainId(31338)
        expect(await signer.estimateGas({ to: addr })).to.equal(eg2)
      })

      it('forward estimateGas - specific chain', async () => {
        expect(await signer.estimateGas({ to: addr }, { chainId: 31337 })).to.equal(eg1)
        expect(await signer.estimateGas({ to: addr }, { chainId: 31338 })).to.equal(eg2)
      })

      it('forward estimateGas - static network provider', async () => {
        expect(await signer.getSigner('hardhat').estimateGas({ to: addr })).to.equal(eg1)
        expect(await signer.getSigner('hardhat2').estimateGas({ to: addr })).to.equal(eg2)
      })

      it('fail to forward estimateGas - static network provider for different chain', async () => {
        await expect(signer.getSigner('hardhat2').estimateGas({ to: addr }, { chainId: 31337 })).to.be.rejectedWith(
          'This signer only supports the network 31338, but 31337 was requested.'
        )
      })
    })

    describe('call', () => {
      let signer: SequenceSigner
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
        signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      })

      it('forward call - default', async () => {
        expect(await signer.call({ to: addr })).to.equal('0x112233')

        signer.provider.setDefaultChainId(31338)
        expect(await signer.call({ to: addr })).to.equal('0x')
      })

      it('forward call - specific chain', async () => {
        expect(await signer.call({ to: addr }, { chainId: 31337 })).to.equal('0x112233')
        expect(await signer.call({ to: addr }, { chainId: 31338 })).to.equal('0x')
      })

      it('forward call - static network provider', async () => {
        expect(await signer.getSigner(31337).call({ to: addr })).to.equal('0x112233')
        expect(await signer.getSigner(31338).call({ to: addr })).to.equal('0x')
      })

      it('fail to forward call - static network provider for different chain', async () => {
        await expect(signer.getSigner('hardhat2').call({ to: addr }, { chainId: 31337 })).to.be.rejectedWith(
          'This signer only supports the network 31338, but 31337 was requested.'
        )
      })
    })

    describe('getFeeData', () => {
      let signer: SequenceSigner

      beforeEach(() => {
        // NOTICE: We need to path the hardhat providers so they return different gas prices
        signer = new SequenceProvider(basicMockClient, (chainId: number) => {
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
        }).getSigner()
      })

      it('forward getFeeData - default', async () => {
        expect((await signer.getFeeData()).gasPrice).to.equal(1n)

        signer.provider.setDefaultChainId(31338)
        expect((await signer.getFeeData()).gasPrice).to.equal(2n)
      })

      it('forward getFeeData - specific chain', async () => {
        expect((await signer.getFeeData({ chainId: 31337 })).gasPrice).to.equal(1n)
        expect((await signer.getFeeData({ chainId: 31338 })).gasPrice).to.equal(2n)
      })

      it('forward getFeeData - static network provider', async () => {
        expect((await signer.getSigner('hardhat').getFeeData()).gasPrice).to.equal(1n)
        expect((await signer.getSigner(31338).getFeeData()).gasPrice).to.equal(2n)
      })

      it('fail to forward getFeeData - static network provider for different chain', async () => {
        await expect(signer.getSigner('hardhat').getFeeData({ chainId: 31338 })).to.be.rejectedWith(
          'This signer only supports the network 31337, but 31338 was requested.'
        )
      })
    })

    describe('ENS', () => {
      let signer: SequenceSigner
      let mainnetProvider: ethers.JsonRpcProvider

      let vitalikAddr: string | null

      before(async () => {
        mainnetProvider = new ethers.JsonRpcProvider('https://nodes.sequence.app/mainnet')
        vitalikAddr = await mainnetProvider.resolveName('vitalik.eth')
      })

      beforeEach(() => {
        signer = new SequenceProvider(
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
        ).getSigner()
      })

      it('resolve normal address', async () => {
        const addr = ethers.Wallet.createRandom().address
        expect(await signer.resolveName(addr)).to.equal(addr)
      })

      it('forward resolveName on primary provider', async () => {
        expect(await signer.resolveName('vitalik.eth')).to.equal(vitalikAddr)
      })

      it('forward resolveName on single network (mainnet) provider', async () => {
        expect(await signer.getSigner('mainnet').resolveName('vitalik.eth')).to.equal(vitalikAddr)
      })

      it('fail to forward resolveName on single network (hardhat) provider', async () => {
        await expect(signer.getSigner('hardhat').resolveName('vitalik.eth')).to.be.rejectedWith(
          'This provider only supports the network 31337, but 1 was requested.'
        )
      })

      it('shuld fail if the name is not resolved', async () => {
        await expect(signer.resolveName('pleasedontregisterthisorelsethistestwillfail.eth')).to.be.rejectedWith(
          'ENS name not found: pleasedontregisterthisorelsethistestwillfail.eth'
        )
      })
    })
  })

  describe('connect', () => {
    it('should connect to new sequence provider', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      const newProvider = new SequenceProvider(basicMockClient, providerFor)

      expect(signer.provider).to.not.equal(newProvider)
      const newSigner = signer.connect(newProvider)

      expect(signer).to.not.equal(newSigner)
      expect(newSigner.provider).to.equal(newProvider)
    })

    it('should fail to connect to non-sequence provider', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      expect(() => signer.connect(hardhat1Provider)).to.throw('SequenceSigner can only be connected to a SequenceProvider')
    })
  })

  describe('single networks signer', () => {
    it('default chainId signer should return this', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      expect(signer.getSigner()).to.equal(signer)
    })

    it('static network matching default chainId should not return this', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      expect(signer.getSigner(31337)).to.not.equal(signer)
    })

    it('static network should be memoized', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      expect(signer.getSigner(31337)).to.equal(signer.getSigner('hardhat'))
    })

    it('static network should math the one provided by the provider', () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const signer = provider.getSigner()
      expect(signer.getSigner(31337).provider).to.equal(provider.getSigner(31337).provider)
    })

    it('static network provider should return static network signer', () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const staticProvider = provider.getProvider(31337)
      const signer = staticProvider.getSigner()
      expect(SingleNetworkSequenceSigner.is(signer)).to.be.true
    })

    it('static network provider should return static network signer when asking for the same chainId', () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const staticProvider = provider.getProvider(31337)
      const signer = staticProvider.getSigner(31337)
      expect(SingleNetworkSequenceSigner.is(signer)).to.be.true
      expect(signer).to.equal(staticProvider.getSigner())
    })

    it('static network provider should fail to return signer for different chainId', () => {
      const provider = new SequenceProvider(basicMockClient, providerFor)
      const staticProvider = provider.getProvider(31337)
      expect(() => staticProvider.getSigner(31338)).to.throw(
        'This provider only supports the network 31337, but 31338 was requested.'
      )
    })

    it('static network signer should return static chainId', async () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      expect(await signer.getChainId()).to.equal(31337)
    })

    it('static network signer should return self when asking for the same chainId', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      const snetwork = signer.getSigner(31337)
      expect(snetwork.getSigner(31337)).to.equal(snetwork)
    })

    it('static network signer should return self when asked for a signer without chainId', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner()
      const snetwork = signer.getSigner(31337)
      expect(snetwork.getSigner()).to.equal(snetwork)
    })

    it('static network signer should fail to return signer for a different chainId', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      expect(() => signer.getSigner(31338)).to.throw('This signer only supports the network 31337, but 31338 was requested.')
    })

    it('static network signer should return static network provider', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      const provider = signer.getProvider()
      expect(SingleNetworkSequenceProvider.is(provider)).to.be.true
    })

    it('static network signer should return static network provider when asked for same chainId', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      const provider = signer.getProvider(31337)
      expect(SingleNetworkSequenceProvider.is(provider)).to.be.true
      expect(provider).to.equal(signer.getProvider())
    })

    it('static network signer should fail to return provider for different chainId', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      expect(() => signer.getProvider(31338)).to.throw('This signer only supports the network 31337, but 31338 was requested.')
    })

    it('signer getProvider should return main provider', () => {
      const signer = new SequenceProvider(basicMockClient, providerFor).getSigner(31337)
      expect(signer.getProvider()).to.equal(signer.provider)
    })
  })

  describe('signMessage', () => {
    let signer: SequenceSigner

    let callsToSignMessage: number
    let expectedSignMessage: ethers.BytesLike
    let expectedOptions: OptionalEIP6492 & OptionalChainId
    let returnValue: string

    beforeEach(() => {
      callsToSignMessage = 0
      expectedSignMessage = ethers.hexlify(ethers.randomBytes(64))
      expectedOptions = {}
      returnValue = ethers.hexlify(ethers.randomBytes(99))

      signer = new SequenceProvider(
        {
          ...basicMockClient,
          signMessage: async (message: string, options: OptionalEIP6492 & OptionalChainId) => {
            expect(message).to.equal(expectedSignMessage)
            expect(options).to.deep.equal(expectedOptions)
            callsToSignMessage++
            return returnValue
          }
        } as unknown as SequenceClient,
        providerFor
      ).getSigner()
    })

    it('should sign message on default chain', async () => {
      expectedOptions = { chainId: 31337, eip6492: true }
      expect(await signer.signMessage(expectedSignMessage)).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on default chain without using eip6492', async () => {
      expectedOptions = { chainId: 31337, eip6492: false }
      expect(await signer.signMessage(expectedSignMessage, { eip6492: false })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on default chain after switching networks', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      signer.provider.setDefaultChainId(31338)
      expect(await signer.signMessage(expectedSignMessage)).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on default chain after switching networks without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      signer.provider.setDefaultChainId(31338)
      expect(await signer.signMessage(expectedSignMessage, { eip6492: false })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on specific chain', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.signMessage(expectedSignMessage, { chainId: 31338 })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on specific chain without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(await signer.signMessage(expectedSignMessage, { chainId: 31338, eip6492: false })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on specific chain using string network name', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.signMessage(expectedSignMessage, { chainId: 'hardhat2' })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on specific chain using string network name without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(await signer.signMessage(expectedSignMessage, { chainId: 'hardhat2', eip6492: false })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on static network signer', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.getSigner(31338).signMessage(expectedSignMessage)).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on static network signer without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(await signer.getSigner(31338).signMessage(expectedSignMessage, { eip6492: false })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should sign message on static network signer if passing chainId', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.getSigner(31338).signMessage(expectedSignMessage, { chainId: 31338 })).to.equal(returnValue)
      expect(callsToSignMessage).to.equal(1)
    })

    it('should fail to sign message on static network signer if passing different chainId', async () => {
      await expect(signer.getSigner(31338).signMessage(expectedSignMessage, { chainId: 31337 })).to.be.rejectedWith(
        'This signer only supports the network 31338, but 31337 was requested.'
      )
    })

    it('should pass array instead of string', async () => {
      expectedSignMessage = ethers.randomBytes(199)
      expectedOptions = { chainId: 31337, eip6492: true }
      expect(await signer.signMessage(expectedSignMessage)).to.equal(returnValue)
    })
  })

  describe('signTypedData', () => {
    let signer: SequenceSigner

    let callsToSignTypedData: number
    let expectedDomain: ethers.TypedDataDomain
    let expectedTypes: Record<string, Array<ethers.TypedDataField>>
    let expectedMessage: Record<string, any>
    let expectedOptions: OptionalEIP6492 & OptionalChainId
    let returnValue: string

    beforeEach(() => {
      callsToSignTypedData = 0
      expectedDomain = {
        name: 'Sequence',
        version: '1',
        chainId: 31337,
        verifyingContract: ethers.hexlify(ethers.randomBytes(12))
      }
      expectedTypes = {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        MetaTransaction: [
          { name: 'nonce', type: 'uint256' },
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      }
      expectedMessage = {
        nonce: 1,
        from: ethers.hexlify(ethers.randomBytes(12)),
        to: ethers.hexlify(ethers.randomBytes(20)),
        data: ethers.hexlify(ethers.randomBytes(32))
      }
      expectedOptions = {}
      returnValue = ethers.hexlify(ethers.randomBytes(99))

      signer = new SequenceProvider(
        {
          ...basicMockClient,
          signTypedData: async (typedData: TypedData, options: OptionalEIP6492 & OptionalChainId) => {
            expect(typedData.domain).to.deep.equal(expectedDomain)
            expect(typedData.types).to.deep.equal(expectedTypes)
            expect(typedData.message).to.deep.equal(expectedMessage)
            expect(options).to.deep.equal(expectedOptions)
            callsToSignTypedData++
            return returnValue
          }
        } as unknown as SequenceClient,
        providerFor
      ).getSigner()
    })

    it('should sign typed data on default chain', async () => {
      expectedOptions = { chainId: 31337, eip6492: true }
      expect(await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage)).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on default chain without using eip6492', async () => {
      expectedOptions = { chainId: 31337, eip6492: false }
      expect(await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, { eip6492: false })).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on default chain after switching networks', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      signer.provider.setDefaultChainId(31338)
      expect(await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage)).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on default chain after switching networks without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      signer.provider.setDefaultChainId(31338)
      expect(await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, { eip6492: false })).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on specific chain', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, { chainId: 31338 })).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on specific chain without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(
        await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, { chainId: 31338, eip6492: false })
      ).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on specific chain using string network name', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(
        await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, {
          chainId: 'hardhat2'
        })
      ).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on specific chain using string network name without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(
        await signer.signTypedData(expectedDomain, expectedTypes, expectedMessage, {
          chainId: 'hardhat2',
          eip6492: false
        })
      ).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on static network signer', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(await signer.getSigner(31338).signTypedData(expectedDomain, expectedTypes, expectedMessage)).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on static network signer without using eip6492', async () => {
      expectedOptions = { chainId: 31338, eip6492: false }
      expect(
        await signer.getSigner(31338).signTypedData(expectedDomain, expectedTypes, expectedMessage, { eip6492: false })
      ).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should sign typed data on static network signer if passing chainId', async () => {
      expectedOptions = { chainId: 31338, eip6492: true }
      expect(
        await signer.getSigner(31338).signTypedData(expectedDomain, expectedTypes, expectedMessage, { chainId: 31338 })
      ).to.equal(returnValue)
      expect(callsToSignTypedData).to.equal(1)
    })

    it('should fail to sign typed data on static network signer if passing different chainId', async () => {
      await expect(
        signer.getSigner(31338).signTypedData(expectedDomain, expectedTypes, expectedMessage, { chainId: 31337 })
      ).to.be.rejectedWith('This signer only supports the network 31338, but 31337 was requested.')
    })
  })

  describe('sendTransaction', () => {
    let callsToSendTransaction: number
    let expectedTransactionRequest: ethers.TransactionRequest[] | ethers.TransactionRequest

    let expectedOptions: OptionalChainIdLike

    let signer: SequenceSigner

    beforeEach(() => {
      callsToSendTransaction = 0

      expectedTransactionRequest = {
        to: ethers.hexlify(ethers.randomBytes(12)),
        value: parseEther('1.0'),
        data: ethers.hexlify(ethers.randomBytes(55)),
        gasLimit: 40000
      }

      expectedOptions = {}

      signer = new SequenceProvider(
        {
          ...basicMockClient,
          sendTransaction: async (
            transactionRequest: ethers.TransactionRequest[] | ethers.TransactionRequest,
            options: OptionalChainIdLike
          ) => {
            expect(transactionRequest).to.deep.equal(expectedTransactionRequest)
            expect(options).to.deep.equal(expectedOptions)
            callsToSendTransaction++

            // Send a random transaction on the expected chainId
            // so we can return some "hash", otherwise the provider
            // will throw an error
            const subsig = testAccounts[(options?.chainId ?? 31337) === 31337 ? 0 : 1]
            const tx = await subsig.sendTransaction({
              to: ethers.Wallet.createRandom().address
            })

            return tx.hash
          }
        } as unknown as SequenceClient,
        providerFor
      ).getSigner()
    })

    it('should send transaction on default chain', async () => {
      expectedOptions = { chainId: 31337 }
      const tx = await signer.sendTransaction(expectedTransactionRequest).then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should send transaction on default chain after switching networks', async () => {
      expectedOptions = { chainId: 31338 }
      signer.provider.setDefaultChainId(31338)
      const tx = await signer.sendTransaction(expectedTransactionRequest).then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should send transaction on specific chain', async () => {
      expectedOptions = { chainId: 31338 }
      const tx = await signer.sendTransaction(expectedTransactionRequest, { chainId: 31338 }).then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should send transaction on specific chain using string network name', async () => {
      expectedOptions = { chainId: 31338 }
      const tx = await signer.sendTransaction(expectedTransactionRequest, { chainId: 'hardhat2' }).then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should send transaction on static network signer', async () => {
      expectedOptions = { chainId: 31338 }
      const tx = await signer
        .getSigner(31338)
        .sendTransaction(expectedTransactionRequest)
        .then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should send transaction on static network signer if passing chainId', async () => {
      expectedOptions = { chainId: 31338 }
      const tx = await signer
        .getSigner(31338)
        .sendTransaction(expectedTransactionRequest, { chainId: 'hardhat2' })
        .then(tx => tx.wait())
      expect(ethers.getBytes(tx!.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })

    it('should fail to send transaction on static network signer if passing different chainId', async () => {
      await expect(signer.getSigner(31338).sendTransaction(expectedTransactionRequest, { chainId: 31337 })).to.be.rejectedWith(
        'This signer only supports the network 31338, but 31337 was requested.'
      )
    })

    it('should send batch transaction', async () => {
      expectedOptions = { chainId: 31338 }
      expectedTransactionRequest = [
        {
          to: ethers.hexlify(ethers.randomBytes(12)),
          value: parseEther('1.0'),
          data: ethers.hexlify(ethers.randomBytes(55))
        },
        {
          to: ethers.hexlify(ethers.randomBytes(12)),
          data: ethers.hexlify(ethers.randomBytes(1))
        },
        {
          to: ethers.hexlify(ethers.randomBytes(12)),
          value: 2
        }
      ]

      const tx = await signer.sendTransaction(expectedTransactionRequest, { chainId: 31338 })
      expect(tx.wait()).to.be.fulfilled
      expect(ethers.getBytes(tx.hash)).to.have.lengthOf(32)
      expect(callsToSendTransaction).to.equal(1)
    })
  })
})

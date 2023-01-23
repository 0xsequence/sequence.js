import { delay, mockDate } from './utils'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { LocalRelayer } from '@0xsequence/relayer'

import { NetworkConfig } from '@0xsequence/network'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import * as utils from '@0xsequence/tests'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)

import { Session, SessionDumpV1, SessionSettings, ValidateSequenceWalletProof } from '../src'

import * as mockServer from 'mockttp'
import { ETHAuth } from '@0xsequence/ethauth'
import { migrator } from '@0xsequence/migration'
import { Orchestrator } from '@0xsequence/signhub'
import { tracker } from '@0xsequence/sessions'
import { LocalConfigTracker } from '@0xsequence/sessions/src/trackers/local'
import { commons, v1, v2 } from '@0xsequence/core'
import { OnChainReader } from '@0xsequence/core/src/commons/reader'
import { Account } from '@0xsequence/account'

type EthereumInstance = {
  chainId?: number
  providerUrl?: string
  provider?: ethers.providers.JsonRpcProvider
  signer?: AbstractSigner
}

class CountingSigner extends AbstractSigner {
  private _signingRequests: number = 0

  constructor(private readonly signer: AbstractSigner) {
    super()
  }

  get signingRequests(): number {
    return this._signingRequests
  }

  getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  signMessage(message: ethers.Bytes | string): Promise<string> {
    this._signingRequests++
    return this.signer.signMessage(message)
  }

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    this._signingRequests++
    return this.signer.signTransaction(transaction)
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return this.signer.connect(provider)
  }
}

describe('Wallet integration', function () {
  const ethnode: EthereumInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let contexts: commons.context.VersionedContext
  let networks: NetworkConfig[]

  let tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  let orchestrator: Orchestrator
  let simpleSettings: SessionSettings

  before(async () => {
    // Provider from hardhat without a server instance
    ethnode.providerUrl = `http://127.0.0.1:9546/`
    ethnode.provider = new ethers.providers.JsonRpcProvider(ethnode.providerUrl)

    ethnode.signer = ethnode.provider.getSigner()
    ethnode.chainId = 31337

    // Deploy local relayer
    relayer = new LocalRelayer(ethnode.signer)

    networks = [
      {
        name: 'local',
        chainId: ethnode.chainId,
        provider: ethnode.provider,
        isDefaultChain: true,
        relayer: relayer
      }
    ] as NetworkConfig[]

    contexts = await utils.context.deploySequenceContexts(ethnode.signer)

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ethnode.signer
    ).deploy()) as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = (await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      ethnode.signer
    ).deploy()) as HookCallerMock

    tracker = new LocalConfigTracker(ethnode.provider!)
    orchestrator = new Orchestrator([])

    simpleSettings = {
      sequenceApiUrl: '',
      sequenceMetadataUrl: '',
      contexts,
      networks,
      orchestrator,
      tracker
    }
  })

  it('Should open a new session', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner])

    const session = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (ws) => {
        expect(ws.length).to.equal(0)
        return undefined
      }
    })

    expect(session.account.address).to.not.equal(ethers.constants.AddressZero)

    const status = await session.account.status(networks[0].chainId)

    expect(v2.config.isWalletConfig(status.config)).to.equal(true)
    const configv2 = status.config as v2.config.WalletConfig

    expect(configv2.threshold).to.deep.equal(ethers.BigNumber.from(1))
    expect(v2.config.isSignerLeaf(configv2.tree)).to.equal(true)

    const leaf = configv2.tree as v2.config.SignerLeaf
    expect(leaf.address).to.equal(referenceSigner.address)
    expect(leaf.weight).to.deep.equal(ethers.BigNumber.from(1))

    await session.account.sendTransaction({ to: referenceSigner.address }, networks[0].chainId)
  })

  it('Should dump and load a session', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner])

    const session = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (ws) => {
        expect(ws.length).to.equal(0)
        return undefined
      }
    })

    const dump = await session.dump()

    const session2 = await Session.load({
      settings: simpleSettings,
      dump
    })

    await session.account.sendTransaction({ to: referenceSigner.address }, networks[0].chainId)

    expect(session.account.address).to.equal(session2.account.address)
  })

  it('Should open an existing session', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner])

    const session = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (ws) => ws[0] ?? undefined
    })

    const newSigner = ethers.Wallet.createRandom()
    const session2 = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: newSigner.address, weight: 1 }],
      threshold: 2,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (ws) => {
        expect(ws.length).to.equal(1)
        return ws[0]
      }
    })

    const newConfig = await session2.account.status(networks[0].chainId).then((s) => s.config) as v2.config.WalletConfig

    expect(session2.account.address).to.equal(session.account.address)
    expect(newConfig.threshold).to.deep.equal(ethers.BigNumber.from(2))

    const newSigners = v2.config.signersOf(newConfig.tree)
    expect(newSigners.length).to.equal(2)
    expect(newSigners).to.include(newSigner.address)
    expect(newSigners).to.include(referenceSigner.address)
    expect((newConfig.tree as any).left.weight).to.deep.equal(ethers.BigNumber.from(1))
    expect((newConfig.tree as any).right.weight).to.deep.equal(ethers.BigNumber.from(1))
  })

  it('Should create a new account if selectWallet returns undefined', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner])

    const oldSession = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async () => undefined
    })

    const newSigner = ethers.Wallet.createRandom()
    const newSession = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: newSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (wallets) => {
        expect(wallets.length).to.equal(1)
        return undefined
      }
    })

    expect(newSession.account.address).to.not.equal(oldSession.account.address)
  })

  it('Should select between two wallets using selectWallet', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner])

    const oldSession1 = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async () => undefined
    })

    const oldSession2 = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: referenceSigner.address, weight: 2 }],
      threshold: 2,
      metadata: {
        name: 'Test'
      },
      selectWallet: async () => undefined
    })

    const newSigner = ethers.Wallet.createRandom()
    const newSession1 = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: newSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (wallets) => {
        expect(wallets.length).to.equal(2)
        expect(wallets).to.include(oldSession1.account.address)
        expect(wallets).to.include(oldSession2.account.address)
        return oldSession1.account.address
      }
    })

    expect(newSession1.account.address).to.equal(oldSession1.account.address)

    const newSession2 = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: newSigner.address, weight: 1 }],
      threshold: 1,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (wallets) => {
        expect(wallets.length).to.equal(2)
        expect(wallets).to.include(oldSession1.account.address)
        expect(wallets).to.include(oldSession2.account.address)
        return oldSession2.account.address
      }
    })

    expect(newSession2.account.address).to.equal(oldSession2.account.address)

    await newSession1.account.sendTransaction([], networks[0].chainId)
    await newSession2.account.sendTransaction([], networks[0].chainId)
  })

  it('Should re-open a session after sending a transaction', async () => {
    const referenceSigner = ethers.Wallet.createRandom()
    const signer1 = ethers.Wallet.createRandom()
    orchestrator.setSigners([referenceSigner, signer1])

    const session = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{
        address: referenceSigner.address, weight: 1,
      }, {
        address: signer1.address, weight: 1
      }],
      threshold: 2,
      metadata: {
        name: 'Test'
      },
      selectWallet: async () => undefined
    })

    await session.account.sendTransaction([], networks[0].chainId)

    const signer2 = ethers.Wallet.createRandom()

    const newSession = await Session.open({
      settings: simpleSettings,
      referenceSigner: referenceSigner.address,
      addSigners: [{ address: signer2.address, weight: 1 }],
      threshold: 2,
      metadata: {
        name: 'Test'
      },
      selectWallet: async (wallets) => {
        expect(wallets.length).to.equal(1)
        return wallets[0]
      }
    })

    expect(newSession.account.address).to.equal(session.account.address)

    await newSession.account.sendTransaction([], networks[0].chainId)
  })

  describe('Migrate sessions', () => {
    let ogAccount: Account
    let referenceSigner: ethers.Wallet
    let v1SessionDump: SessionDumpV1

    beforeEach(async () => {
      // Create a wallet using v1
      referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      ogAccount = await Account.new({
        config: { threshold: 1, checkpoint: 0, signers: [{ address: referenceSigner.address, weight: 1 }] },
        tracker,
        contexts: { 1: contexts[1] },
        orchestrator,
        networks,
        migrations: { 0: {
          version: 1,
          configCoder: v1.config.ConfigCoder,
          signatureCoder: v1.signature.SignatureCoder,
        } as any}
      })

      await ogAccount.publishWitness()

      v1SessionDump = {
        config: {
          threshold: 1,
          signers: [{ address: referenceSigner.address, weight: 1 }],
        },
        metadata: {
          name: 'Test',
        }
      }
    })

    it('Should open and migrate old session, without dump', async () => {
      const newSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner, newSigner])

      const newSession = await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: newSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (wallets) => {
          expect(wallets.length).to.equal(1)
          return wallets[0]
        }
      })

      expect(newSession.account.address).to.equal(ogAccount.address)
      const status = await newSession.account.status(networks[0].chainId)
      expect(status.version).to.equal(2)
      expect(status.fullyMigrated).to.be.true

      await newSession.account.sendTransaction([], networks[0].chainId)
    })

    it('Should open and migrate dump', async () => {
      const newSession = await Session.load({
        settings: simpleSettings,
        dump: v1SessionDump,
      })

      expect(newSession.account.address).to.equal(ogAccount.address)

      const status = await newSession.account.status(networks[0].chainId)
      expect(status.version).to.equal(2)
      expect(status.fullyMigrated).to.be.true

      await newSession.account.sendTransaction([], networks[0].chainId)
    })

    describe('After updating old wallet', () => {
      beforeEach(async () => {
        const status = await ogAccount.status(networks[0].chainId)
        const wallet = ogAccount.walletForStatus(networks[0].chainId, status)

        const newSigner = ethers.Wallet.createRandom()
        orchestrator.setSigners([referenceSigner, newSigner])

        const uptx = await wallet.buildUpdateConfigurationTransaction({
          threshold: 2,
          signers: [
            { address: referenceSigner.address, weight: 1 },
            { address: newSigner.address, weight: 1 }
          ]
        } as v1.config.WalletConfig)

        const suptx = await wallet.signTransactionBundle(uptx)
        await wallet.relayer?.relay(suptx)

        v1SessionDump = {
          ...v1SessionDump,
          config: {
            ...v1SessionDump.config,
            address: wallet.address
          }
        }
      })

      it('Should open and migrate old session', async () => {
        const newSigner2 = ethers.Wallet.createRandom()
  
        const newSession = await Session.open({
          settings: simpleSettings,
          referenceSigner: referenceSigner.address,
          addSigners: [{ address: newSigner2.address, weight: 1 }],
          threshold: 2,
          metadata: {
            name: 'Test'
          },
          selectWallet: async (wallets) => {
            expect(wallets.length).to.equal(1)
            return wallets[0]
          }
        })

        expect(newSession.account.address).to.equal(ogAccount.address)
        const status = await newSession.account.status(networks[0].chainId)
        expect(status.version).to.equal(2)
        expect(status.fullyMigrated).to.be.true

        orchestrator.setSigners([referenceSigner, newSigner2])
        await newSession.account.sendTransaction([], networks[0].chainId)
      })

      it('Should open and migrate dump', async () => {
        const newSession = await Session.load({
          settings: simpleSettings,
          dump: v1SessionDump,
        })

        expect(newSession.account.address).to.equal(ogAccount.address)

        const status = await newSession.account.status(networks[0].chainId)
        expect(status.version).to.equal(2)
        expect(status.fullyMigrated).to.be.true

        await newSession.account.sendTransaction([], networks[0].chainId)
      })
    })
  })

  describe('JWT Auth', () => {
    let server: mockServer.Mockttp
    let fakeJwt: string
    let proofAddress: string

    let delayMs: number = 0
    let totalCount: number = 0
    let recoverCount: { [address: string]: number } = {}

    let alwaysFail: boolean = false

    const sequenceApiUrl = 'http://127.0.0.1:8099'
    let settings: SessionSettings

    beforeEach(() => {
      settings = {
        ...simpleSettings,
        sequenceApiUrl,
        sequenceMetadataUrl: ''
      }

      fakeJwt = ethers.utils.hexlify(ethers.utils.randomBytes(64))

      server = mockServer.getLocal()
      server.start(8099)
      server.forPost('/rpc/API/GetAuthToken').thenCallback(async request => {
        if (delayMs !== 0) await delay(delayMs)

        const validator = ValidateSequenceWalletProof(
          new OnChainReader(networks[0].provider!),
          tracker,
          contexts[2],
          {
            config: v2.config.ConfigCoder as any,
            signature: v2.signature.SignatureCoder as any,
          }
        )

        const ethauth = new ETHAuth(validator)

        ethauth.chainId = ethnode.chainId!
        ethauth.configJsonRpcProvider(ethnode.providerUrl!)

        totalCount++

        if (alwaysFail) return { statusCode: 400 }

        try {
          const proof = await ethauth.decodeProof((await request.body.getJson())!['ewtString'])
          proofAddress = ethers.utils.getAddress(proof.address)

          if (recoverCount[proofAddress]) {
            recoverCount[proofAddress]++
          } else {
            recoverCount[proofAddress] = 1
          }

          return {
            statusCode: 200,
            body: JSON.stringify({
              status: true,
              jwtToken: fakeJwt
            })
          }
        } catch {
          if (recoverCount['error']) {
            recoverCount['error']++
          } else {
            recoverCount['error'] = 1
          }

          return {
            statusCode: 401
          }
        }
      })
    })

    afterEach(() => {
      server.stop()
      delayMs = 0
      totalCount = 0
      recoverCount = {}
      alwaysFail = false
    })

    it('Should get JWT token', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await session.auth()
      expect(totalCount).to.equal(1)
      expect(await session._jwt?.token).to.equal(fakeJwt)
      expect(proofAddress).to.equal(session.account.address)
    })

    it('Should get JWT after updating session', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const newSigner = ethers.Wallet.createRandom()
      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: newSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (ws) => ws[0]
      })

      await session.auth()
      await session._initialAuthRequest

      expect(totalCount).to.equal(1)
      expect(await session._jwt?.token).to.equal(fakeJwt)
      expect(proofAddress).to.equal(session.account.address)
    })

    it('Should get JWT during first session creation', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await session._initialAuthRequest

      expect(totalCount).to.equal(1)
      expect(recoverCount[session.account.address]).to.equal(1)

      expect(await session._jwt?.token).to.equal(fakeJwt)
    })

    it('Should get JWT during session opening', async () => {
      delayMs = 500

      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      let session = await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await expect(session._initialAuthRequest).to.be.rejected

      const newSigner = ethers.Wallet.createRandom()

      session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [
          { address: newSigner.address, weight: 1 }
        ],
        threshold: 2,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (ws) => ws[0]
      })

      await session._initialAuthRequest

      expect(totalCount).to.equal(1)
      expect(recoverCount[session.account.address]).to.equal(1)

      expect(await session._jwt?.token).to.equal(fakeJwt)
    })

    it('Should get API with lazy JWT during first session creation', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const api = await session.getAPIClient()

      expect(totalCount).to.equal(1)
      expect(recoverCount[session.account.address]).to.equal(1)

      expect(await session._jwt?.token).to.equal(fakeJwt)

      server.forPost('/rpc/API/FriendList').thenCallback(async request => {
        const hasToken = request.headers['authorization']!.includes(fakeJwt)
        return { statusCode: hasToken ? 200 : 401, body: JSON.stringify({}) }
      })

      await api.friendList({ page: {} })
    })

    it('Should get API with lazy JWT during session opening', async () => {
      delayMs = 500
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const newSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner, newSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [
          { address: newSigner.address, weight: 1 }
        ],
        threshold: 2,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (ws) => ws[0]
      })

      const api = await session.getAPIClient()

      expect(totalCount).to.equal(1)
      expect(recoverCount[session.account.address]).to.equal(1)

      expect(await session._jwt?.token).to.equal(fakeJwt)

      server.forPost('/rpc/API/FriendList').thenCallback(async request => {
        const hasToken = request.headers['authorization']!.includes(fakeJwt)
        return { statusCode: hasToken ? 200 : 401, body: JSON.stringify({}) }
      })

      await api.friendList({ page: {} })
    })

    it('Should call callbacks on JWT token', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      let calledCallback = 0
      session.onAuth(() => calledCallback++)

      await session._initialAuthRequest

      expect(calledCallback).to.equal(1)
    })

    it('Should call callbacks on JWT token (on open only once)', async () => {
      delayMs = 500

      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const newSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner, newSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [
          { address: referenceSigner.address, weight: 1 },
          { address: newSigner.address, weight: 1 }
        ],
        threshold: 2,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (ws) => ws[0]
      })

      let calledCallback = 0
      session.onAuth(() => calledCallback++)

      await session._initialAuthRequest

      expect(calledCallback).to.equal(1)
    })

    it('Should retry 5 times retrieving the JWT token', async () => {
      delayMs = 1000
      const referenceSigner = ethers.Wallet.createRandom()

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      alwaysFail = true
      await expect(session.auth()).to.be.rejected
      expect(totalCount).to.equal(5)
      expect(session._jwt).to.be.undefined
    })

    it('Should get API with JWT already present', async () => {
      delayMs = 500

      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const newSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner, newSigner])

      const session = await Session.open({
        settings,
        referenceSigner: referenceSigner.address,
        addSigners: [
          { address: newSigner.address, weight: 1 }
        ],
        threshold: 2,
        metadata: {
          name: 'Test'
        },
        selectWallet: async (ws) => ws[0]
      })

      await session._initialAuthRequest
      const totalCountBefore = totalCount

      // This should use the already existing JWT
      const api = await session.getAPIClient()

      expect(totalCount).to.equal(totalCountBefore)
      expect(recoverCount[session.account.address]).to.equal(1)
      expect(await session._jwt?.token).to.equal(fakeJwt)

      server.forPost('/rpc/API/FriendList').thenCallback(async request => {
        const hasToken = request.headers['authorization']!.includes(fakeJwt)
        return { statusCode: hasToken ? 200 : 401, body: JSON.stringify({}) }
      })

      await api.friendList({ page: {} })
    })

    it('Should fail to get API with false tryAuth and no JWT', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      alwaysFail = true

      const session = await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await expect(session._initialAuthRequest).to.be.rejected

      alwaysFail = false

      const apiPromise = session.getAPIClient(false)

      await expect(apiPromise).to.be.rejected

      expect(totalCount).to.equal(0)
      expect(session._jwt).to.be.undefined
    })

    it('Should fail to get API without api url', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      const apiPromise = session.getAPIClient()

      await expect(apiPromise).to.be.rejected

      expect(totalCount).to.equal(0)
      expect(session._jwt).to.be.undefined
    })

    it('Should fail to get JWT with no api configured', async () => {
      const referenceSigner = ethers.Wallet.createRandom()
      orchestrator.setSigners([referenceSigner])

      const session = await Session.open({
        settings: simpleSettings,
        referenceSigner: referenceSigner.address,
        addSigners: [{ address: referenceSigner.address, weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await expect(session.auth()).to.be.rejected

      expect(totalCount).to.equal(0)
      expect(session._jwt).to.be.undefined
    })

    it('Should reuse outstanding JWT requests', async () => {
      const referenceSigner = new CountingSigner(ethers.Wallet.createRandom())
      orchestrator.setSigners([referenceSigner])

      alwaysFail = true

      const session = await Session.open({
        settings,
        referenceSigner: await referenceSigner.getAddress(),
        addSigners: [{ address: await referenceSigner.getAddress(), weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      // 1 signing request is made to publish signers
      expect(referenceSigner.signingRequests).to.equal(1)

      const signingRequestsBefore = referenceSigner.signingRequests

      await expect(session._initialAuthRequest).to.be.rejected

      alwaysFail = false
      totalCount = 0

      // Create a bunch of API clients concurrently
      const requests: any[] = []
      while (requests.length < 10) {
        requests.push(session.getAPIClient())
      }
      await expect(Promise.all(requests)).to.be.fulfilled

      expect(totalCount).to.equal(1)
      expect(referenceSigner.signingRequests).to.equal(signingRequestsBefore + 1)
    })

    it('Should reuse existing proof signatures', async () => {
      const referenceSigner = new CountingSigner(ethers.Wallet.createRandom())
      orchestrator.setSigners([referenceSigner])

      alwaysFail = true

      const session = await Session.open({
        settings,
        referenceSigner: await referenceSigner.getAddress(),
        addSigners: [{ address: await referenceSigner.getAddress(), weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      // 1 signing request is made to publish signers
      expect(referenceSigner.signingRequests).to.equal(1)

      const signingRequestsBefore = referenceSigner.signingRequests

      await expect(session._initialAuthRequest).to.be.rejected

      totalCount = 0

      // Create a bunch of API clients sequentially
      for (let i = 0; i < 10; i++) {
        await expect(session.getAPIClient()).to.be.rejected
      }

      expect(totalCount).to.equal(10)
      expect(referenceSigner.signingRequests).to.equal(signingRequestsBefore + 1)
    })

    it('Should neither re-authenticate nor retry if request succeeds', async () => {
      const referenceSigner = new CountingSigner(ethers.Wallet.createRandom())

      const session = await Session.open({
        settings,
        referenceSigner: await referenceSigner.getAddress(),
        addSigners: [{ address: await referenceSigner.getAddress(), weight: 1 }],
        threshold: 1,
        metadata: {
          name: 'Test'
        },
        selectWallet: async () => undefined
      })

      await session._initialAuthRequest

      const api = await session.getAPIClient()

      const okResponses = [true]
      server.forPost('/rpc/API/FriendList').thenCallback(async () => {
        return { statusCode: okResponses.shift() ? 200 : 401, body: JSON.stringify({}) }
      })

      totalCount = 0

      await expect(api.friendList({ page: {} })).to.be.fulfilled

      // no re-authentication since it succeeded
      expect(totalCount).to.equal(0)
    })

    describe('With expiration', () => {
      let resetDateMock: Function | undefined

      const setDate = (seconds: number) => {
        if (resetDateMock) resetDateMock()
        const newMockDate = new Date()
        newMockDate.setTime(seconds * 1000)
        resetDateMock = mockDate(newMockDate)
      }

      afterEach(() => {
        if (resetDateMock) resetDateMock()
      })

      it('Should request a new JWT after expiration', async () => {
        const baseTime = 1613579057
        setDate(baseTime)

        const referenceSigner = ethers.Wallet.createRandom()
        orchestrator.setSigners([referenceSigner])

        const session = await Session.open({
          settings,
          referenceSigner: referenceSigner.address,
          addSigners: [{ address: referenceSigner.address, weight: 1 }],
          threshold: 1,
          metadata: {
            name: 'Test',
            expiration: 240
          },
          selectWallet: async () => undefined
        })

        await session._initialAuthRequest

        expect(totalCount).to.equal(1)
        expect(await session._jwt?.token).to.equal(fakeJwt)
        expect(session._jwt?.expiration).to.equal(baseTime + 240 - 60)

        // Force expire (1 hour)
        const newBaseTime = baseTime + 60 * 60
        setDate(newBaseTime)

        fakeJwt = ethers.utils.hexlify(ethers.utils.randomBytes(96))

        await session.getAPIClient()

        expect(totalCount).to.equal(2)
        expect(await session._jwt?.token).to.equal(fakeJwt)
        expect(session._jwt?.expiration).to.equal(newBaseTime + 240 - 60)
      })

      it('Should force min expiration time', async () => {
        const baseTime = 1613579057
        setDate(baseTime)

        const referenceSigner = ethers.Wallet.createRandom()
        orchestrator.setSigners([referenceSigner])

        const session = await Session.open({
          settings,
          referenceSigner: referenceSigner.address,
          addSigners: [{ address: referenceSigner.address, weight: 1 }],
          threshold: 1,
          metadata: {
            name: 'Test',
            expiration: 1
          },
          selectWallet: async () => undefined
        })

        await session._initialAuthRequest

        expect(totalCount).to.equal(1)
        expect(await session._jwt?.token).to.equal(fakeJwt)
        expect(session._jwt?.expiration).to.equal(baseTime + 120 - 60)
      })
    })
  })
})

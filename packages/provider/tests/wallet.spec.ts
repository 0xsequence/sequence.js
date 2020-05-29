import { deployArcadeum } from './utils/arcadeum_config'
import { ethers, Signer, Wallet } from 'ethers'
import * as Ganache from 'ganache-cli'

import { CallReceiverMock } from 'arcadeum-wallet/typings/contracts/CallReceiverMock'
import { HookCallerMock } from 'arcadeum-wallet/typings/contracts/HookCallerMock'

import * as arcadeum from '../src'
import { LocalRelayer } from '../src'
import { ArcadeumContext } from '../src/types'
import { AsyncSendable, Web3Provider, JsonRpcProvider } from 'ethers/providers'
import { Signer as AbstractSigner } from 'ethers'

import * as chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { isValidSignature, isValidEthSignSignature, encodeMessageData, isValidWalletSignature, isValidArcadeumDeployedWalletSignature, isValidArcadeumUndeployedWalletSignature, addressOf } from '../src/utils'

const CallReceiverMockArtifact = require('arcadeum-wallet/artifacts/CallReceiverMock.json')
const HookCallerMockArtifact = require('arcadeum-wallet/artifacts/HookCallerMock.json')

const Web3 = require('web3')
const { expect } = chai.use(chaiAsPromised)

const GANACHE_PORT = 38545

type GanacheInstance = {
  server?: any
  serverUri?: string
  provider?: JsonRpcProvider
  signer?: Signer
}

describe('Arcadeum wallet integration', function () {
  let ganache: GanacheInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let context: ArcadeumContext
  let wallet: arcadeum.Wallet

  before(async () => {
    // Deploy Ganache test env
    ganache.server = Ganache.server({ network_id: 1 })
    await ganache.server.listen(GANACHE_PORT)
    ganache.serverUri = `http://localhost:${GANACHE_PORT}/`
    ganache.provider = new ethers.providers.JsonRpcProvider(ganache.serverUri)
    ganache.signer = ganache.provider.getSigner()

    // Deploy Arcadeum env
    const [factory, mainModule, mainModuleUpgradable] = await deployArcadeum(ganache.provider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address
    }

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ganache.signer
    ).deploy()) as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = (await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      ganache.signer
    ).deploy()) as HookCallerMock

    // Deploy local relayer
    relayer = new LocalRelayer(ganache.signer)
  })

  beforeEach(async () => {
    // Create wallet
    const pk = ethers.utils.randomBytes(32)
    wallet = await arcadeum.Wallet.singleOwner(context, pk)
    wallet = wallet.connect(ganache.serverUri, relayer)
  })

  after(async () => {
    ganache.server.close()
  })

  describe('with ethers.js', () => {
    let w3provider: AsyncSendable
    let provider: Web3Provider

    let options = [
      {
        name: 'arcadeum-wallet',
        signer: () => wallet
      },
      {
        name: 'ethers-signer',
        signer: () => provider.getSigner()
      }
    ]

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      provider = new ethers.providers.Web3Provider(w3provider)
    })

    it('Should return accounts', async () => {
      const accounts = await provider.listAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    options.forEach(s => {
      describe(`using ${s.name} provider`, () => {
        let signer: AbstractSigner

        beforeEach(async () => {
          signer = s.signer()
        })

        it('Should call contract method', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          await contractWithSigner.testCall(412313, '0x11222334')
          expect(await contractWithSigner.lastValB()).to.equal('0x11222334')
        })

        it('Should deploy contract', async () => {
          ;(await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            signer
          ).deploy()) as CallReceiverMock
        })

        it('Should perform multiple transactions', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          await contractWithSigner.testCall(412313, '0x11222334')
          await contractWithSigner.testCall(11111, '0x')
        })

        it('Should return transaction count', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          expect(await provider.getTransactionCount(wallet.address)).to.equal(0)

          await contractWithSigner.testCall(1, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(1)

          await contractWithSigner.testCall(2, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(2)

          await contractWithSigner.testCall(3, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(3)
        })

        describe('signing', async () => {
          it('Should sign a message', async () => {
            const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')

            const signature = await signer.signMessage(message)

            // Contract wallet must be deployed before calling ERC1271
            await relayer.deploy(wallet.config, context)

            const call = hookCaller.callERC1271isValidSignatureData(wallet.address, message, signature)
            await expect(call).to.be.fulfilled
          })
        })
      })

      describe('batch transactions', async () => {
        it('Should send two transactions at once', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
            auxiliary: [
              {
                gas: '121000',
                to: callReceiver2.address,
                value: 0,
                data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
        })

        it('Should send three transactions at once', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const callReceiver3 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
            auxiliary: [
              {
                gas: '100000',
                to: callReceiver2.address,
                value: 0,
                data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
              },
              {
                gas: '70000',
                to: callReceiver3.address,
                value: 0,
                data: callReceiver.interface.functions.testCall.encode([2, '0x778899'])
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
          expect(await callReceiver3.lastValB()).to.equal('0x778899')
        })

        it('Should send nested transactions', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const callReceiver3 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ganache.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            from: wallet.address,
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
            auxiliary: [
              {
                gas: '100000',
                to: callReceiver2.address,
                value: 0,
                data: callReceiver.interface.functions.testCall.encode([2, '0x445566']),
                auxiliary: [
                  {
                    gas: '70000',
                    to: callReceiver3.address,
                    value: 0,
                    data: callReceiver.interface.functions.testCall.encode([2, '0x778899'])
                  }
                ]
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
          expect(await callReceiver3.lastValB()).to.equal('0x778899')
        })
      })
    })

    describe('wallet batch transactions', async () => {
      it('Should send two transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const transaction = [
          {
            gasPrice: '20000000000',
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([1, '0x112233'])
          },
          {
            gasPrice: '20000000000',
            gas: '121000',
            to: callReceiver2.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
          }
        ]

        await wallet.sendTransaction(transaction)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
      })

      it('Should send three transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const transaction = [
          {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([1, '0x112233'])
          },
          {
            gas: '100000',
            to: callReceiver2.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
          },
          {
            gas: '70000',
            to: callReceiver3.address,
            value: 0,
            data: callReceiver.interface.functions.testCall.encode([2, '0x778899'])
          }
        ]

        await wallet.sendTransaction(transaction)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })
    })
  })

  describe('with web3', () => {
    let w3provider: AsyncSendable
    let w3: any

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      w3 = new Web3(w3provider)
    })

    it('Should return accounts', async () => {
      const accounts = await w3.eth.getAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    it('Should call contract method', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      await contractWithSigner.methods.testCall(412313, '0x11222334').send({ from: wallet.address })
      expect(await contractWithSigner.methods.lastValB().call()).to.equal('0x11222334')
    })

    it('Should deploy contract', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi)
      await contractWithSigner.deploy({
        data: CallReceiverMockArtifact.bytecode
      })
    })

    it('Should perform multiple transactions', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      await contractWithSigner.methods.testCall(412313, '0x11222334').send({ from: wallet.address })
      await contractWithSigner.methods.testCall(11111, '0x').send({ from: wallet.address })
    })

    it('Should return transaction count', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(0)

      await contractWithSigner.methods.testCall(1, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(1)

      await contractWithSigner.methods.testCall(2, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(2)

      await contractWithSigner.methods.testCall(3, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(3)
    })

    describe('signing', async () => {
      it('Should sign transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gasLimit: '121000',
          to: '0x3535353535353535353535353535353535353535',
          value: '1000000000000000000',
          data: '0x9988776655'
        })

        expect(signed.raw).to.be.a('string')
        expect(signed.tx.gasLimit).to.equal('121000')
        expect(signed.tx.to).to.equal('0x3535353535353535353535353535353535353535')
        expect(signed.tx.value).to.equal('0xde0b6b3a7640000')
        expect(signed.tx.data).to.equal('0x9988776655')
        expect(signed.tx.delegateCall).to.equal(false)
        expect(signed.tx.revertOnError).to.equal(false)
      })

      it('Should sign a message', async () => {
        const message = 'Hi! this is a test message'

        const signature = await w3.eth.sign(message, wallet.address)

        // Contract wallet must be deployed before calling ERC1271
        await relayer.deploy(wallet.config, context)

        const call = hookCaller.callERC1271isValidSignatureData(wallet.address, ethers.utils.toUtf8Bytes(message), signature)
        await expect(call).to.be.fulfilled
      })

      it('Should sign and send transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([123, '0x445566'])
        })

        const tx = await w3.eth.sendSignedTransaction(signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })

      it('Should sign, aggregate and send a transaction', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s3 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const config = {
          threshold: 3,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            },
            {
              address: s3.address,
              weight: 1
            }
          ]
        }

        const wallet_1 = new arcadeum.Wallet(config, context, s1).connect(ganache.serverUri, relayer)
        const wallet_2 = new arcadeum.Wallet(config, context, s2).connect(ganache.serverUri, relayer)
        const wallet_3 = new arcadeum.Wallet(config, context, s3).connect(ganache.serverUri, relayer)

        expect(wallet_1.address).to.equal(wallet_2.address)
        expect(wallet_2.address).to.equal(wallet_3.address)

        const w3_1 = new Web3(new arcadeum.Provider(wallet_1))
        const w3_2 = new Web3(new arcadeum.Provider(wallet_2))
        const w3_3 = new Web3(new arcadeum.Provider(wallet_3))

        const transaction = {
          from: wallet_1.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([123, '0x445566'])
        }

        const signed_1 = await w3_1.eth.signTransaction(transaction)
        const signed_2 = await w3_2.eth.signTransaction(transaction)
        const signed_3 = await w3_3.eth.signTransaction(transaction)

        const full_signed = {
          raw: arcadeum.utils.aggregate(signed_1.raw, signed_2.raw, signed_3.raw),
          tx: signed_1.tx
        }

        const tx = await w3_1.eth.sendSignedTransaction(full_signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })
    })

    describe('batch transactions', async () => {
      it('Should send two transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
          auxiliary: [
            {
              gas: '121000',
              to: callReceiver2.address,
              value: 0,
              data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
      })

      it('Should send three transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
          auxiliary: [
            {
              gas: '100000',
              to: callReceiver2.address,
              value: 0,
              data: callReceiver.interface.functions.testCall.encode([2, '0x445566'])
            },
            {
              gas: '70000',
              to: callReceiver3.address,
              value: 0,
              data: callReceiver.interface.functions.testCall.encode([2, '0x778899'])
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })

      it('Should send nested transactions', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ganache.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([1, '0x112233']),
          auxiliary: [
            {
              gas: '100000',
              to: callReceiver2.address,
              value: 0,
              data: callReceiver.interface.functions.testCall.encode([2, '0x445566']),
              auxiliary: [
                {
                  gas: '70000',
                  to: callReceiver3.address,
                  value: 0,
                  data: callReceiver.interface.functions.testCall.encode([2, '0x778899'])
                }
              ]
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })
    })
  })

  describe('Validate signatures', () => {
    const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
    const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

    // TODO: Test EIP712 Sign

    describe('ethSign', () => {
      it('Should validate ethSign signature', async () => {
        const signer = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer.signMessage(digest)
        expect(await isValidSignature(signer.address, digest, signature)).to.be.true
      })
      it('Should validate ethSign signature using direct method', async () => {
        const signer = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer.signMessage(digest)
        expect(isValidEthSignSignature(signer.address, digest, signature)).to.be.true
      })
      it('Should reject invalid ethSign signature using direct method', async () => {
        const signer1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signer2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer1.signMessage(digest)
        expect(await isValidSignature(signer2.address, digest, signature)).to.be.undefined
      })
    })
    describe('deployed arcadeum wallet sign', async () => {
      it('Should validate arcadeum wallet signature', async () => {
        const signature = await wallet.signMessage(message, 1)
        await relayer.deploy(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ganache.provider)).to.be.true
      })
      it('Should validate arcadeum wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message, 1)
        await relayer.deploy(wallet.config, context)
        expect(await isValidArcadeumDeployedWalletSignature(wallet.address, digest, signature, ganache.provider)).to.be.true
      })
      it('Should reject arcadeum wallet invalid signature', async () => {
        const wallet2 = await arcadeum.Wallet.singleOwner(context, new ethers.Wallet(ethers.utils.randomBytes(32)))
        const signature = await wallet2.signMessage(message, 1)
        await relayer.deploy(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ganache.provider, context)).to.be.false
      })
      describe('After updating the owners', () => {
        // TODO: Test signature should be invalidated if owners change
      })
    })
    describe('non-deployed arcadeum wallet sign', async () => {
      it('Should validate arcadeum wallet signature', async () => {
        const signature = await wallet.signMessage(message, 1)
        expect(await isValidSignature(wallet.address, digest, signature, ganache.provider, context)).to.be.true
      })
      it('Should validate arcadeum wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message, 1)
        expect(await isValidArcadeumUndeployedWalletSignature(wallet.address, digest, signature, context, ganache.provider)).to.be.true
      })
      it('Should reject arcadeum wallet invalid signature', async () => {
        const wallet2 = await arcadeum.Wallet.singleOwner(context, new ethers.Wallet(ethers.utils.randomBytes(32)))
        const signature = await wallet2.signMessage(message, 1)
        expect(await isValidSignature(wallet.address, digest, signature, ganache.provider, context)).to.be.false
      })
      describe('After updating the owners', () => {
        // TODO: Test signature should be invalidated if owners change
      })
    })
    describe('deployed wallet sign', () => {
      it('Should validate wallet signature', async () => {
        const signature = await wallet.signMessage(message, 1)
        const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(encodeMessageData(wallet.address, 1, digest)))
        await relayer.deploy(wallet.config, context)
        expect(await isValidSignature(wallet.address, subDigest, signature, ganache.provider)).to.be.true
      })
      it('Should validate wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message, 1)
        const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(encodeMessageData(wallet.address, 1, digest)))
        await relayer.deploy(wallet.config, context)
        expect(await isValidWalletSignature(wallet.address, subDigest, signature, ganache.provider)).to.be.true
      })
      it('Should reject invalid wallet signature', async () => {
        const wallet2 = await arcadeum.Wallet.singleOwner(context, new ethers.Wallet(ethers.utils.randomBytes(32)))
        const signature = await wallet2.signMessage(message, 1)
        const subDigest = ethers.utils.arrayify(ethers.utils.keccak256(encodeMessageData(wallet.address, 1, digest)))
        await relayer.deploy(wallet.config, context)
        expect(await isValidSignature(wallet.address, subDigest, signature, ganache.provider, context)).to.be.false
      })
    })
  })
  describe('Update wallet configuration', () => {
    let transaction: arcadeum.Transactionish
    beforeEach(async () => {
      transaction = {
        from: wallet.address,
        gasPrice: '20000000000',
        to: callReceiver.address,
        value: 0,
        data: callReceiver.interface.functions.testCall.encode([123, '0x445566'])
      }
    })
    it('Should migrate and update to a new single owner configuration', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 1,
        signers: [
          {
            address: s1.address,
            weight: 1
          }
        ]
      }

      const [config, tx] = await wallet.updateConfig(newConfig)
      await tx.wait()

      const updatedWallet = new arcadeum.Wallet(config, context, s1).connect(ganache.serverUri, relayer)

      expect(ethers.utils.getAddress(await ganache.provider.getStorageAt(wallet.address, wallet.address)))
        .to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

      expect(updatedWallet.address).to.be.equal(wallet.address)
      expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

      await updatedWallet.sendTransaction(transaction)
    })
    it('Should migrate and update to a new multiple owner configuration', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 2,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const [config, tx] = await wallet.updateConfig(newConfig)
      const txr = await tx.wait()

      const updatedWallet = new arcadeum.Wallet(config, context, s1, s2).connect(ganache.serverUri, relayer)

      expect(ethers.utils.getAddress(await ganache.provider.getStorageAt(wallet.address, wallet.address)))
        .to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

      expect(updatedWallet.address).to.be.equal(wallet.address)
      expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

      await updatedWallet.sendTransaction(transaction)
    })
    describe('after migrating and updating', () => {
      let wallet2: arcadeum.Wallet

      beforeEach(async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 1,
          signers: [
            {
              address: s1.address,
              weight: 1
            }
          ]
        }
  
        const [config, tx] = await wallet.updateConfig(newConfig)
        await tx.wait()

        wallet2 = new arcadeum.Wallet(config, context, s1).connect(ganache.serverUri, relayer)
      })
      it('Should update to a new single owner configuration', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 1,
          signers: [
            {
              address: s1.address,
              weight: 1
            }
          ]
        }
  
        const [config, tx] = await wallet2.updateConfig(newConfig)
        await tx.wait()
  
        const updatedWallet = new arcadeum.Wallet(config, context, s1).connect(ganache.serverUri, relayer)
  
        expect(ethers.utils.getAddress(await ganache.provider.getStorageAt(wallet2.address, wallet2.address)))
          .to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))
  
        expect(updatedWallet.address).to.be.equal(wallet2.address)
        expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))
  
        await updatedWallet.sendTransaction(transaction)
      })
      it('Should update to a new multiple owner configuration', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
  
        const newConfig = {
          threshold: 2,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            }
          ]
        }
  
        const [config, tx] = await wallet2.updateConfig(newConfig)
        await tx.wait()
  
        const updatedWallet = new arcadeum.Wallet(config, context, s1, s2).connect(ganache.serverUri, relayer)
  
        expect(ethers.utils.getAddress(await ganache.provider.getStorageAt(wallet2.address, wallet2.address)))
          .to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))
  
        expect(updatedWallet.address).to.be.equal(wallet2.address)
        expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))
  
        await updatedWallet.sendTransaction(transaction)
      })
      it('Should reject transaction of previous owner', async () => {
        const tx = wallet.sendTransaction(transaction)
        expect(tx).to.be.rejected
      })
    })
    it('Should reject a non-usable configuration', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 3,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const prom = wallet.buildUpdateConfig(newConfig)
      await expect(prom).to.be.rejected
    })
    it('Should accept a non-usable configuration in non-strict mode', async () => {
      const wallet = (await arcadeum.Wallet.singleOwner(
        { nonStrict: true, ...context},
        new ethers.Wallet(ethers.utils.randomBytes(32))
      )).connect(ganache.serverUri, relayer)

      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 3,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const prom = wallet.buildUpdateConfig(newConfig)
      await expect(prom).to.be.not.rejected
    })
  })
})
